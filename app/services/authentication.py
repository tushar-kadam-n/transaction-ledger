import hashlib
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from dotenv import load_dotenv

from app.database import get_db
from app.models.user import User


_password_hasher = PasswordHasher()
ACCESS_TOKEN_LIFETIME = timedelta(minutes=15)
DEFAULT_REFRESH_TOKEN_LIFETIME = timedelta(days=7)


class JWTConfigurationError(RuntimeError):
    """Raised when access-token signing configuration is unavailable."""


class CookieConfigurationError(RuntimeError):
    """Raised when cookie or CSRF configuration is invalid."""


@dataclass(frozen=True)
class CookieSettings:
    refresh_cookie_name: str
    csrf_cookie_name: str
    csrf_header_name: str
    secure: bool
    same_site: str
    path: str
    domain: str | None
    refresh_lifetime: timedelta


def get_cookie_settings() -> CookieSettings:
    load_dotenv()

    def setting(name: str, default: str) -> str:
        return os.getenv(name, default).strip()

    refresh_cookie_name = setting(
        "REFRESH_COOKIE_NAME",
        setting("REFRESH_TOKEN_COOKIE_NAME", "refresh_token"),
    )
    csrf_cookie_name = setting("CSRF_COOKIE_NAME", "csrf_token")
    csrf_header_name = setting("CSRF_HEADER_NAME", "X-CSRF-Token")
    path = setting("COOKIE_PATH", "/api/auth")
    same_site = setting("COOKIE_SAMESITE", "lax").lower()
    domain = setting("COOKIE_DOMAIN", "") or None

    if not refresh_cookie_name or not csrf_cookie_name or not csrf_header_name:
        raise CookieConfigurationError("Cookie names and header names are required.")
    if not path.startswith("/"):
        raise CookieConfigurationError("Cookie path must be absolute.")
    if same_site not in {"strict", "lax", "none"}:
        raise CookieConfigurationError("Cookie SameSite setting is invalid.")

    secure_value = os.getenv("COOKIE_SECURE")
    if secure_value is None:
        secure = setting("APP_ENV", "local").lower() in {"production", "prod"}
    else:
        secure = secure_value.strip().lower() in {"1", "true", "yes", "on"}
    if same_site == "none" and not secure:
        raise CookieConfigurationError("SameSite=None requires secure cookies.")

    lifetime_value = setting(
        "REFRESH_TOKEN_LIFETIME_SECONDS",
        setting(
            "REFRESH_TOKEN_LIFETIME",
            str(int(DEFAULT_REFRESH_TOKEN_LIFETIME.total_seconds())),
        ),
    )
    try:
        lifetime_seconds = int(lifetime_value)
    except ValueError:
        raise CookieConfigurationError("Refresh token lifetime is invalid.") from None
    if lifetime_seconds <= 0:
        raise CookieConfigurationError("Refresh token lifetime must be positive.")

    return CookieSettings(
        refresh_cookie_name=refresh_cookie_name,
        csrf_cookie_name=csrf_cookie_name,
        csrf_header_name=csrf_header_name,
        secure=secure,
        same_site=same_site,
        path=path,
        domain=domain,
        refresh_lifetime=timedelta(seconds=lifetime_seconds),
    )


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError, ValueError):
        return False


def get_jwt_signing_secret() -> str:
    load_dotenv()
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if len(secret) < 32:
        raise JWTConfigurationError("JWT signing is not configured.")
    return secret


def create_access_token(
    subject: UUID,
    signing_secret: str,
    now: datetime | None = None,
) -> tuple[str, datetime]:
    issued_at = (now or datetime.now(timezone.utc)).replace(microsecond=0)
    expires_at = issued_at + ACCESS_TOKEN_LIFETIME
    payload = {
        "sub": str(subject),
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, signing_secret, algorithm="HS256")
    return token, expires_at


def create_verification_token() -> str:
    return secrets.token_urlsafe(32)


def create_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def hash_verification_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        secret = get_jwt_signing_secret()
        claims = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
        user_id = UUID(claims["sub"])
    except (JWTConfigurationError, jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise unauthorized from None
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_verified:
        raise unauthorized
    return user
