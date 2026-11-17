
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.services.authentication import create_access_token, hash_password


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL is missing from your .env file"
    )

if not TEST_DATABASE_URL.endswith("/transaction_ledger_test"):
    raise RuntimeError(
        "Tests must use the transaction_ledger_test database"
    )

test_engine = create_engine(
    TEST_DATABASE_URL,
    pool_pre_ping=True,
)

TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    test_engine.dispose()


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # Ledger regression tests operate as one local, verified test user.
    test_email = "ledger-regression@example.test"
    with TestingSessionLocal() as db:
        user = db.query(User).filter(User.email == test_email).one_or_none()
        if user is None:
            user = User(email=test_email, password_hash=hash_password("local-test-password"), is_verified=True)
            db.add(user)
            db.commit()
        test_user_id = user.id
    os.environ.setdefault("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")
    token, _ = create_access_token(test_user_id, os.environ["JWT_SECRET_KEY"])

    with TestClient(app) as test_client:
        test_client.headers["Authorization"] = f"Bearer {token}"
        yield test_client

    app.dependency_overrides.clear()
