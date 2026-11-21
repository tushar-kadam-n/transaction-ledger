import hashlib
import html
import re
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from unittest.mock import AsyncMock

import pytest
import jwt
from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth_token import AuthToken
from app.models.user import User
from app.routes import auth as auth_routes
from app.services import authentication as auth_service
from app.services.email import EmailDeliveryError
from tests.conftest import TestingSessionLocal


@pytest.fixture
def tracked_emails():
    emails = set()
    yield emails
    with TestingSessionLocal() as db:
        users = db.scalars(select(User).where(User.email.in_(emails))).all()
        for user in users:
            db.delete(user)
        db.commit()


def _payload(email="User@Example.com", password="correct-horse-7"):
    return {
        "email": email,
        "password": password,
        "confirm_password": password,
    }


def _verification_token(mock_send_email):
    body = mock_send_email.await_args.args[2]
    match = re.search(r'href="([^"]+)"', body)
    assert match is not None
    link = urlsplit(html.unescape(match.group(1)))
    assert link.path == "/verify-email"
    return parse_qs(link.query)["token"][0]


def _user_by_email(db, email):
    return db.scalar(select(User).where(User.email == email))


def _create_login_user(email, password, is_verified=True):
    with TestingSessionLocal() as db:
        user = User(
            email=email,
            password_hash=auth_service.hash_password(password),
            is_verified=is_verified,
        )
        db.add(user)
        db.commit()
        return user.id


def test_login_returns_signed_access_token_for_verified_user(
    client, monkeypatch, tracked_emails
):
    email_address = "login@example.com"
    password = "correct-horse-7"
    tracked_emails.add(email_address)
    user_id = _create_login_user(email_address, password)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")

    response = client.post(
        "/api/auth/login",
        json={"email": "  LOGIN@Example.com ", "password": password},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 900
    assert "password_hash" not in body
    assert email_address not in response.text
    assert password not in response.text
    claims = jwt.decode(
        body["access_token"],
        "local-test-signing-secret-at-least-32-bytes",
        algorithms=["HS256"],
    )
    assert claims["sub"] == str(user_id)
    assert claims["exp"] - claims["iat"] == 900
    assert body["expires_at"].endswith("+00:00")
    assert int(datetime.fromisoformat(body["expires_at"]).timestamp()) == claims["exp"]


def test_login_rejects_invalid_email_without_echoing_password(client):
    password = "correct-horse-7"
    response = client.post(
        "/api/auth/login", json={"email": "invalid-email", "password": password}
    )

    assert response.status_code == 422
    assert password not in response.text


def test_login_uses_generic_error_for_unknown_email_and_wrong_password(
    client, tracked_emails
):
    email_address = "wrong-password@example.com"
    tracked_emails.add(email_address)
    _create_login_user(email_address, "correct-horse-7")
    unknown = client.post(
        "/api/auth/login",
        json={"email": "unknown@example.com", "password": "wrong-password"},
    )
    wrong_password = client.post(
        "/api/auth/login",
        json={"email": email_address, "password": "wrong-password"},
    )

    assert unknown.status_code == wrong_password.status_code == 401
    assert unknown.json()["detail"] == wrong_password.json()["detail"]
    assert "unknown@example.com" not in unknown.text
    assert "wrong-password" not in wrong_password.text


def test_login_requires_verified_email_after_validating_password(
    client, tracked_emails
):
    email_address = "unverified-login@example.com"
    tracked_emails.add(email_address)
    _create_login_user(email_address, "correct-horse-7", is_verified=False)

    incorrect = client.post(
        "/api/auth/login",
        json={"email": email_address, "password": "incorrect-password"},
    )
    valid = client.post(
        "/api/auth/login",
        json={"email": email_address, "password": "correct-horse-7"},
    )

    assert incorrect.status_code == 401
    assert valid.status_code == 403
    assert "verification" in valid.json()["detail"].lower()
    assert "correct-horse-7" not in valid.text


def test_login_fails_safely_when_jwt_secret_is_missing(
    client, monkeypatch, tracked_emails, caplog
):
    email_address = "missing-secret@example.com"
    password = "correct-horse-7"
    tracked_emails.add(email_address)
    _create_login_user(email_address, password)
    monkeypatch.setattr(auth_service, "load_dotenv", lambda: None)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    response = client.post(
        "/api/auth/login",
        json={"email": email_address, "password": password},
    )

    assert response.status_code == 503
    assert "JWTConfigurationError" in caplog.text
    assert "access_token" not in response.text
    assert "JWT_SECRET_KEY" not in response.text
    assert password not in caplog.text
    assert email_address not in caplog.text


def test_login_logs_cookie_configuration_failure_without_sensitive_values(
    client, monkeypatch, tracked_emails, caplog
):
    email_address = "cookie-config-login@example.com"
    password = "sensitive-login-password"
    tracked_emails.add(email_address)
    _create_login_user(email_address, password)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")
    monkeypatch.setattr(
        auth_routes,
        "get_cookie_settings",
        lambda: (_ for _ in ()).throw(
            auth_service.CookieConfigurationError("sensitive-cookie-setting")
        ),
    )

    response = client.post(
        "/api/auth/login", json={"email": email_address, "password": password}
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Authentication is temporarily unavailable."
    assert "CookieConfigurationError" in caplog.text
    assert "sensitive-cookie-setting" not in caplog.text
    assert password not in caplog.text
    assert email_address not in caplog.text


def test_login_logs_safe_integrity_diagnostics_without_sensitive_values(
    client, monkeypatch, tracked_emails, caplog
):
    email_address = f"integrity-login-{uuid.uuid4()}@example.com"
    password = "sensitive-login-password"
    tracked_emails.add(email_address)
    _create_login_user(email_address, password)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")
    constraint_name = "fk_refresh_sessions_user_id_users"

    class FakeDriverError(Exception):
        sqlstate = "23503"
        diag = SimpleNamespace(constraint_name=constraint_name)

    original = FakeDriverError("sensitive-driver-message")

    def fail_commit(_session):
        raise IntegrityError(
            "sensitive-sql-with-password",
            {"password": password, "token": "sensitive-refresh-token"},
            original,
        )

    with monkeypatch.context() as request_patch:
        request_patch.setattr(Session, "commit", fail_commit)
        response = client.post(
            "/api/auth/login", json={"email": email_address, "password": password}
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Authentication is temporarily unavailable."
    assert "IntegrityError" in caplog.text
    assert "23503" in caplog.text
    assert constraint_name in caplog.text
    for sensitive_value in (
        email_address,
        password,
        "sensitive-sql-with-password",
        "sensitive-refresh-token",
        "sensitive-driver-message",
    ):
        assert sensitive_value not in caplog.text


def test_registration_normalizes_email_hashes_password_and_starts_unverified(
    client, monkeypatch, tracked_emails
):
    tracked_emails.add("user@example.com")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_email", send_email)

    response = client.post(
        "/api/auth/register", json=_payload("  User@Example.COM  ")
    )

    assert response.status_code == 201
    assert "token" not in response.text
    send_email.assert_awaited_once()
    assert send_email.await_args.args[0] == "user@example.com"

    with TestingSessionLocal() as db:
        user = _user_by_email(db, "user@example.com")
        assert user is not None
        assert user.is_verified is False
        assert user.verified_at is None
        assert user.password_hash != "correct-horse-7"
        assert PasswordHasher().verify(user.password_hash, "correct-horse-7")


@pytest.mark.parametrize(
    ("payload", "sensitive_value"),
    [
        (_payload("invalid-email"), "correct-horse-7"),
        (_payload(password="short", email="short@example.com"), "short"),
        (
            {
                "email": "mismatch@example.com",
                "password": "password-one",
                "confirm_password": "password-two",
            },
            "password-one",
        ),
    ],
)
def test_registration_validation_does_not_echo_passwords(
    client, monkeypatch, payload, sensitive_value
):
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_email", send_email)

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422
    assert sensitive_value not in response.text
    send_email.assert_not_awaited()


def test_registration_rejects_duplicate_normalized_email(
    client, monkeypatch, tracked_emails
):
    tracked_emails.add("duplicate@example.com")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_email", send_email)

    first = client.post(
        "/api/auth/register", json=_payload("duplicate@example.com")
    )
    duplicate = client.post(
        "/api/auth/register", json=_payload(" Duplicate@Example.com ")
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert send_email.await_count == 1


def test_verification_token_is_hashed_expires_and_is_single_use(
    client, monkeypatch, tracked_emails
):
    email_address = "token@example.com"
    tracked_emails.add(email_address)
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_email", send_email)

    registration = client.post(
        "/api/auth/register", json=_payload(email_address)
    )
    raw_token = _verification_token(send_email)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    assert registration.status_code == 201

    with TestingSessionLocal() as db:
        token_record = db.scalar(
            select(AuthToken).where(AuthToken.token_hash == token_hash)
        )
        user = _user_by_email(db, email_address)
        assert token_record is not None
        assert token_record.token_hash != raw_token
        assert token_record.purpose == "email_verification"
        assert token_record.used_at is None
        assert timedelta(hours=23, minutes=59) < (
            token_record.expires_at - token_record.created_at
        ) <= timedelta(hours=24, seconds=1)
        assert user is not None and user.is_verified is False

    verified = client.post("/api/auth/verify-email", json={"token": raw_token})
    replay = client.post("/api/auth/verify-email", json={"token": raw_token})

    assert verified.status_code == 200
    assert replay.status_code == 400
    assert raw_token not in verified.text
    with TestingSessionLocal() as db:
        user = _user_by_email(db, email_address)
        token_record = db.scalar(
            select(AuthToken).where(AuthToken.token_hash == token_hash)
        )
        assert user is not None and user.is_verified is True
        assert user.verified_at is not None
        assert token_record is not None and token_record.used_at is not None


def test_verification_rejects_unknown_token(client):
    response = client.post(
        "/api/auth/verify-email", json={"token": "not-a-valid-token"}
    )

    assert response.status_code == 400
    assert "not-a-valid-token" not in response.text


def test_verification_rejects_expired_and_wrong_purpose_tokens(
    client, monkeypatch, tracked_emails
):
    addresses = {"expired@example.com", "wrong-purpose@example.com"}
    tracked_emails.update(addresses)
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    send_email = AsyncMock()
    monkeypatch.setattr(auth_routes, "send_email", send_email)

    expired_token = None
    wrong_purpose_token = None
    for address in sorted(addresses):
        client.post("/api/auth/register", json=_payload(address))
        raw_token = _verification_token(send_email)
        if address.startswith("expired"):
            expired_token = raw_token
        else:
            wrong_purpose_token = raw_token

    with TestingSessionLocal() as db:
        expired_hash = hashlib.sha256(expired_token.encode()).hexdigest()
        wrong_hash = hashlib.sha256(wrong_purpose_token.encode()).hexdigest()
        db.scalar(select(AuthToken).where(AuthToken.token_hash == expired_hash)).expires_at = (
            datetime.now(timezone.utc) - timedelta(seconds=1)
        )
        db.scalar(select(AuthToken).where(AuthToken.token_hash == wrong_hash)).purpose = (
            "password_reset"
        )
        db.commit()

    expired_response = client.post(
        "/api/auth/verify-email", json={"token": expired_token}
    )
    wrong_purpose_response = client.post(
        "/api/auth/verify-email", json={"token": wrong_purpose_token}
    )

    assert expired_response.status_code == 400
    assert wrong_purpose_response.status_code == 400
    assert expired_token not in expired_response.text
    assert wrong_purpose_token not in wrong_purpose_response.text
    with TestingSessionLocal() as db:
        for address in addresses:
            user = _user_by_email(db, address)
            assert user is not None and user.is_verified is False


def test_email_delivery_failure_rolls_back_registration(
    client, monkeypatch, tracked_emails
):
    email_address = "retry@example.com"
    tracked_emails.add(email_address)
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    send_email = AsyncMock(
        side_effect=EmailDeliveryError("internal provider detail")
    )
    monkeypatch.setattr(auth_routes, "send_email", send_email)

    failed = client.post("/api/auth/register", json=_payload(email_address))

    assert failed.status_code == 503
    assert "internal provider detail" not in failed.text
    raw_token = _verification_token(send_email)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    with TestingSessionLocal() as db:
        assert _user_by_email(db, email_address) is None
        assert (
            db.scalar(select(AuthToken.id).where(AuthToken.token_hash == token_hash))
            is None
        )

    send_email.side_effect = None
    retried = client.post("/api/auth/register", json=_payload(email_address))
    assert retried.status_code == 201
