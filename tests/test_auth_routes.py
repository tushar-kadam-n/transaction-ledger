import hashlib
import html
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit
from unittest.mock import AsyncMock

import pytest
from argon2 import PasswordHasher
from sqlalchemy import select

from app.models.auth_token import AuthToken
from app.models.user import User
from app.routes import auth as auth_routes
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
