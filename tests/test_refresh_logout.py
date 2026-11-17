import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.services import authentication as auth_service
from tests.conftest import TestingSessionLocal


def _create_user(email: str, password: str = "correct-horse-7"):
    with TestingSessionLocal() as db:
        user = User(
            email=email,
            password_hash=auth_service.hash_password(password),
            is_verified=True,
        )
        db.add(user)
        db.commit()
        return user.id


def _cleanup(email: str):
    with TestingSessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is not None:
            db.delete(user)
            db.commit()


def test_login_sets_hashed_refresh_token_and_csrf_cookie(client, monkeypatch):
    email = "refresh-login@example.com"
    password = "correct-horse-7"
    _create_user(email, password)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")

    try:
        response = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )

        assert response.status_code == 200
        assert response.json().get("refresh_token") is None
        refresh_token = response.cookies.get("refresh_token")
        csrf_token = response.cookies.get("csrf_token")
        assert refresh_token and csrf_token
        assert "HttpOnly" in response.headers["set-cookie"]

        with TestingSessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email))
            session = db.scalar(select(RefreshSession).where(RefreshSession.user_id == user.id))
            assert session is not None
            assert session.token_hash == hashlib.sha256(
                refresh_token.encode()
            ).hexdigest()
            assert session.token_hash != refresh_token
            assert session.expires_at > datetime.now(timezone.utc)
    finally:
        _cleanup(email)


def test_refresh_rotates_token_and_rejects_replay(client, monkeypatch):
    email = "refresh-rotation@example.com"
    password = "correct-horse-7"
    _create_user(email, password)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")

    try:
        login = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        old_refresh = login.cookies.get("refresh_token")
        old_csrf = login.cookies.get("csrf_token")
        client.cookies.set("csrf_token", old_csrf, path="/api/auth")

        refreshed = client.post(
            "/api/auth/refresh", headers={"X-CSRF-Token": old_csrf}
        )

        assert refreshed.status_code == 200
        new_refresh = refreshed.cookies.get("refresh_token")
        new_csrf = refreshed.cookies.get("csrf_token")
        assert new_refresh and new_refresh != old_refresh
        assert new_csrf and new_csrf != old_csrf

        with TestingSessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email))
            session = db.scalar(select(RefreshSession).where(RefreshSession.user_id == user.id))
            assert session is not None
            assert session.token_hash == hashlib.sha256(
                new_refresh.encode()
            ).hexdigest()
            assert session.last_used_at is not None

        replay_client = TestClient(client.app)
        replay_client.cookies.set("refresh_token", old_refresh, path="/api/auth")
        replay_client.cookies.set("csrf_token", old_csrf, path="/api/auth")
        replay = replay_client.post(
            "/api/auth/refresh", headers={"X-CSRF-Token": old_csrf}
        )
        assert replay.status_code == 401
    finally:
        _cleanup(email)


def test_concurrent_refresh_attempts_only_allow_one_rotation(client, monkeypatch):
    email = "concurrent-refresh@example.com"
    _create_user(email)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")

    try:
        login = client.post(
            "/api/auth/login", json={"email": email, "password": "correct-horse-7"}
        )
        refresh_token = login.cookies.get("refresh_token")
        csrf_token = login.cookies.get("csrf_token")

        def attempt_refresh():
            concurrent_client = TestClient(client.app)
            concurrent_client.cookies.set(
                "refresh_token", refresh_token, path="/api/auth"
            )
            concurrent_client.cookies.set("csrf_token", csrf_token, path="/api/auth")
            return concurrent_client.post(
                "/api/auth/refresh", headers={"X-CSRF-Token": csrf_token}
            ).status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(lambda _: attempt_refresh(), range(2)))

        assert sorted(statuses) == [200, 401]
    finally:
        _cleanup(email)


def test_refresh_requires_matching_csrf(client, monkeypatch):
    email = "refresh-csrf@example.com"
    _create_user(email)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")

    try:
        client.post(
            "/api/auth/login", json={"email": email, "password": "correct-horse-7"}
        )
        assert client.post("/api/auth/refresh").status_code == 403
        assert client.post(
            "/api/auth/refresh", headers={"X-CSRF-Token": "wrong"}
        ).status_code == 403
    finally:
        _cleanup(email)


def test_logout_revokes_session_and_clears_cookies(client, monkeypatch):
    email = "logout@example.com"
    _create_user(email)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")

    try:
        login = client.post(
            "/api/auth/login", json={"email": email, "password": "correct-horse-7"}
        )
        csrf_token = login.cookies.get("csrf_token")
        logout = client.post(
            "/api/auth/logout", headers={"X-CSRF-Token": csrf_token}
        )
        assert logout.status_code == 200
        assert 'refresh_token="";' in logout.headers["set-cookie"]
        assert 'csrf_token="";' in logout.headers["set-cookie"]

        with TestingSessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email))
            session = db.scalar(select(RefreshSession).where(RefreshSession.user_id == user.id))
            assert session is not None and session.revoked_at is not None
        assert client.post(
            "/api/auth/refresh", headers={"X-CSRF-Token": csrf_token}
        ).status_code == 403
    finally:
        _cleanup(email)


def test_expired_refresh_session_is_rejected(client, monkeypatch):
    email = "expired-refresh@example.com"
    _create_user(email)
    monkeypatch.setenv("JWT_SECRET_KEY", "local-test-signing-secret-at-least-32-bytes")

    try:
        login = client.post(
            "/api/auth/login", json={"email": email, "password": "correct-horse-7"}
        )
        csrf_token = login.cookies.get("csrf_token")
        with TestingSessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email))
            session = db.scalar(select(RefreshSession).where(RefreshSession.user_id == user.id))
            session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.commit()
        response = client.post(
            "/api/auth/refresh", headers={"X-CSRF-Token": csrf_token}
        )
        assert response.status_code == 401
    finally:
        _cleanup(email)
