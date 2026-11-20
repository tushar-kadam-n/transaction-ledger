import os

import resend
from dotenv import load_dotenv


class EmailConfigurationError(RuntimeError):
    """Raised when required email service configuration is unavailable."""


class EmailDeliveryError(RuntimeError):
    """Raised when the email provider cannot accept a message."""


async def send_email(recipient: str, subject: str, html: str) -> None:
    """Send an HTML email using the configured Resend sender."""
    load_dotenv()
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("EMAIL_FROM", "").strip()
    if not api_key or not sender:
        raise EmailConfigurationError("Email service is not configured.")

    resend.api_key = api_key
    try:
        await resend.Emails.send_async(
            {
                "from": sender,
                "to": [recipient],
                "subject": subject,
                "html": html,
            }
        )
    except Exception:
        # Provider SDK and transport failures must not leak internal details.
        raise EmailDeliveryError("Email delivery failed.") from None
