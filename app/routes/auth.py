import html
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit

from dotenv import load_dotenv

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.auth_token import AuthToken
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.schemas.auth import LoginRequest, RegistrationRequest, VerifyEmailRequest
from app.services.authentication import (
    ACCESS_TOKEN_LIFETIME,
    CookieConfigurationError,
    create_csrf_token,
    JWTConfigurationError,
    create_access_token,
    create_refresh_token,
    create_verification_token,
    get_jwt_signing_secret,
    get_cookie_settings,
    hash_password,
    hash_refresh_token,
    hash_verification_token,
    verify_password,
)
from app.services.email import EmailConfigurationError, EmailDeliveryError, send_email


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(
        user.password_hash, payload.password.get_secret_value()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification is required before login.",
        )

    try:
        signing_secret = get_jwt_signing_secret()
        cookie_settings = get_cookie_settings()
        access_token, expires_at = create_access_token(user.id, signing_secret)
        refresh_token = create_refresh_token()
        csrf_token = create_csrf_token()
        now = datetime.now(timezone.utc)
        db.add(
            RefreshSession(
                user_id=user.id,
                token_hash=hash_refresh_token(refresh_token),
                expires_at=now + cookie_settings.refresh_lifetime,
            )
        )
        db.commit()
    except (JWTConfigurationError, CookieConfigurationError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        ) from None
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        ) from None

    response = JSONResponse(
        content={
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": int(ACCESS_TOKEN_LIFETIME.total_seconds()),
            "expires_at": expires_at.isoformat(),
        }
    )
    _set_auth_cookies(response, cookie_settings, refresh_token, csrf_token)
    return response


def _set_auth_cookies(
    response: Response,
    settings,
    refresh_token: str,
    csrf_token: str,
) -> None:
    common = {
        "max_age": int(settings.refresh_lifetime.total_seconds()),
        "path": settings.path,
        "domain": settings.domain,
        "secure": settings.secure,
        "samesite": settings.same_site,
    }
    response.set_cookie(
        settings.refresh_cookie_name,
        refresh_token,
        httponly=True,
        **common,
    )
    response.set_cookie(settings.csrf_cookie_name, csrf_token, **common)


def _clear_auth_cookies(response: Response, settings) -> None:
    for cookie_name in (settings.refresh_cookie_name, settings.csrf_cookie_name):
        response.delete_cookie(
            cookie_name,
            path=settings.path,
            domain=settings.domain,
            samesite=settings.same_site,
        )


def _require_csrf(request: Request, settings) -> None:
    csrf_cookie = request.cookies.get(settings.csrf_cookie_name)
    csrf_header = request.headers.get(settings.csrf_header_name)
    if (
        not csrf_cookie
        or not csrf_header
        or not secrets.compare_digest(csrf_cookie, csrf_header)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed.",
        )


def _invalid_refresh() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh session.",
    )


@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        cookie_settings = get_cookie_settings()
    except CookieConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        ) from None
    _require_csrf(request, cookie_settings)
    raw_token = request.cookies.get(cookie_settings.refresh_cookie_name)
    if not raw_token:
        raise _invalid_refresh()

    session = db.execute(
        select(RefreshSession)
        .where(RefreshSession.token_hash == hash_refresh_token(raw_token))
        .with_for_update()
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (
        session is None
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        raise _invalid_refresh()

    user = db.scalar(select(User).where(User.id == session.user_id))
    if user is None or not user.is_verified:
        raise _invalid_refresh()

    try:
        signing_secret = get_jwt_signing_secret()
        new_refresh_token = create_refresh_token()
        new_csrf_token = create_csrf_token()
        access_token, expires_at = create_access_token(user.id, signing_secret)
        session.token_hash = hash_refresh_token(new_refresh_token)
        session.last_used_at = now
        session.expires_at = now + cookie_settings.refresh_lifetime
        db.commit()
    except JWTConfigurationError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        ) from None
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        ) from None

    _set_auth_cookies(response, cookie_settings, new_refresh_token, new_csrf_token)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": int(ACCESS_TOKEN_LIFETIME.total_seconds()),
        "expires_at": expires_at.isoformat(),
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        cookie_settings = get_cookie_settings()
    except CookieConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        ) from None
    _require_csrf(request, cookie_settings)
    raw_token = request.cookies.get(cookie_settings.refresh_cookie_name)
    if raw_token:
        session = db.execute(
            select(RefreshSession)
            .where(RefreshSession.token_hash == hash_refresh_token(raw_token))
            .with_for_update()
        ).scalar_one_or_none()
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    _clear_auth_cookies(response, cookie_settings)
    return {"message": "Logged out successfully."}


def _verification_link(token: str) -> str:
    load_dotenv()
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    try:
        parsed = urlsplit(frontend_url)
    except ValueError:
        parsed = None
    if (
        parsed is None
        or parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise EmailConfigurationError("Email service is not configured.")

    return f"{frontend_url}/verify-email?{urlencode({'token': token})}"


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegistrationRequest,
    db: Session = Depends(get_db),
):
    try:
        verification_token = create_verification_token()
        link = _verification_link(verification_token)
    except EmailConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration is temporarily unavailable.",
        ) from None

    existing_user = db.scalar(select(User.id).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password.get_secret_value()),
        is_verified=False,
    )
    now = datetime.now(timezone.utc)
    auth_token = AuthToken(
        user=user,
        token_hash=hash_verification_token(verification_token),
        purpose="email_verification",
        expires_at=now + timedelta(hours=24),
    )
    db.add(user)
    db.add(auth_token)

    try:
        db.flush()
        await send_email(
            user.email,
            "Verify your Transaction Ledger email",
            "<p>Confirm your email address to finish creating your account.</p>"
            f'<p><a href="{html.escape(link, quote=True)}">Verify email</a></p>',
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        ) from None
    except (EmailConfigurationError, EmailDeliveryError):
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send verification email. Please try again.",
        ) from None

    return {
        "message": "Registration successful. Check your email to verify your account."
    }


@router.post("/verify-email")
def verify_email(
    payload: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    token_record = db.execute(
        select(AuthToken)
        .where(AuthToken.token_hash == hash_verification_token(
            payload.token.get_secret_value()
        ))
        .with_for_update()
    ).scalar_one_or_none()

    if (
        token_record is None
        or token_record.purpose != "email_verification"
        or token_record.used_at is not None
        or token_record.expires_at <= now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    user = db.execute(
        select(User).where(User.id == token_record.user_id).with_for_update()
    ).scalar_one_or_none()
    if user is None or user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    token_record.used_at = now
    user.is_verified = True
    user.verified_at = now
    db.commit()

    return {"message": "Email verified successfully."}
