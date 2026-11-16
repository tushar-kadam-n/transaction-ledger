import html
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.auth_token import AuthToken
from app.models.user import User
from app.schemas.auth import RegistrationRequest, VerifyEmailRequest
from app.services.authentication import (
    create_verification_token,
    hash_password,
    hash_verification_token,
)
from app.services.email import EmailConfigurationError, EmailDeliveryError, send_email


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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
