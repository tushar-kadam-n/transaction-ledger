import hashlib
import re
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import jwt
from argon2 import PasswordHasher
from sqlalchemy import select

from app.models.account import Account
from app.models.auth_token import AuthToken
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.services import authentication
from app.routes import auth as auth_routes
from tests.conftest import TestingSessionLocal


SECRET = "local-test-signing-secret-at-least-32-bytes"


def test_protected_account_routes_reject_missing_and_invalid_tokens(client, monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", SECRET)
    client.headers.pop("Authorization", None)
    assert client.get("/api/accounts").status_code == 401
    client.headers["Authorization"] = "Bearer malformed"
    assert client.get("/api/accounts").status_code == 401
    expired = jwt.encode({"sub": "00000000-0000-0000-0000-000000000001", "exp": 1}, SECRET, algorithm="HS256")
    client.headers["Authorization"] = f"Bearer {expired}"
    assert client.get("/api/accounts").status_code == 401


def test_account_and_transaction_ownership_are_enforced(client, monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", SECRET)
    response = client.post("/api/accounts", json={
        "name": "owned", "account_type": "savings", "email": "owned@example.test",
        "user_id": "00000000-0000-0000-0000-000000000001",
    })
    assert response.status_code == 422  # client cannot provide ownership
    response = client.post("/api/accounts", json={
        "name": "owned", "account_type": "savings", "email": "owned@example.test",
    })
    assert response.status_code == 201
    account_id = response.json()["id"]
    with TestingSessionLocal() as db:
        owner = db.scalar(select(User).where(User.email == "ledger-regression@example.test"))
        assert owner is not None
        assert db.get(Account, account_id).user_id == owner.id
        outsider = User(email=f"ownership-outsider-{uuid.uuid4()}@example.test", password_hash=authentication.hash_password("test-password"), is_verified=True)
        db.add(outsider)
        db.commit()
        outsider_token, _ = authentication.create_access_token(outsider.id, SECRET)
    client.headers["Authorization"] = f"Bearer {outsider_token}"
    assert client.get("/api/accounts").json() == []
    assert client.get(f"/api/accounts/{account_id}/balance").status_code == 404
    assert client.get(f"/api/transactions?account_id={account_id}").status_code == 404
    assert client.post(f"/api/accounts/{account_id}/transactions", json={
        "type": "credit", "amount": "10", "description": "test", "reference_id": "x",
        "transaction_date": datetime.now(timezone.utc).isoformat(),
    }).status_code == 404


def test_forgot_password_is_generic_and_reset_revokes_sessions(client, monkeypatch):
    email = f"reset-{uuid.uuid4()}@example.test"
    monkeypatch.setenv("JWT_SECRET_KEY", SECRET)
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_email", send_email)
    with TestingSessionLocal() as db:
        user = User(email=email, password_hash=authentication.hash_password("old-password"), is_verified=True)
        db.add(user)
        db.flush()
        db.add(RefreshSession(user_id=user.id, token_hash=hashlib.sha256(uuid.uuid4().bytes).hexdigest(), expires_at=datetime.now(timezone.utc) + timedelta(days=1)))
        db.commit()
        user_id = user.id
    missing = client.post("/api/auth/forgot-password", json={"email": "nobody@example.test"})
    requested = client.post("/api/auth/forgot-password", json={"email": f" {email.upper()} "})
    assert missing.status_code == requested.status_code == 200
    assert missing.json() == requested.json()
    assert send_email.await_count == 1
    body = send_email.await_args.args[2]
    token = re.search(r"token=([^&\"]+)", body).group(1)
    # URL-safe token characters need no decoding for this generated format.
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with TestingSessionLocal() as db:
        stored = db.scalar(select(AuthToken).where(AuthToken.token_hash == token_hash))
        assert stored is not None and stored.purpose == "password_reset"
        assert stored.token_hash != token
    reset = client.post("/api/auth/reset-password", json={"token": token, "password": "new-password", "confirm_password": "new-password"})
    assert reset.status_code == 200
    assert token not in reset.text
    with TestingSessionLocal() as db:
        user = db.get(User, user_id)
        assert PasswordHasher().verify(user.password_hash, "new-password")
        session = db.scalar(select(RefreshSession).where(RefreshSession.user_id == user_id))
        assert session.revoked_at is not None
    replay = client.post("/api/auth/reset-password", json={"token": token, "password": "another-password", "confirm_password": "another-password"})
    assert replay.status_code == 400
