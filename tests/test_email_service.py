import asyncio
from unittest.mock import AsyncMock

import pytest
from resend.exceptions import ResendError

from app.services import email


def test_send_email_uses_resend_async(monkeypatch):
    monkeypatch.setattr(email, "load_dotenv", lambda: None)
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    monkeypatch.setenv("EMAIL_FROM", "Ledger <ledger@example.com>")
    send_async = AsyncMock(return_value={"id": "test-email-id"})
    monkeypatch.setattr(email.resend.Emails, "send_async", send_async)

    asyncio.run(
        email.send_email(
            "recipient@example.com",
            "Test subject",
            "<p>Test message</p>",
        )
    )

    send_async.assert_awaited_once_with(
        {
            "from": "Ledger <ledger@example.com>",
            "to": ["recipient@example.com"],
            "subject": "Test subject",
            "html": "<p>Test message</p>",
        }
    )


@pytest.mark.parametrize(
    ("api_key", "sender"),
    [(None, "Ledger <ledger@example.com>"), ("test-key", None)],
)
def test_send_email_rejects_missing_configuration(monkeypatch, api_key, sender):
    monkeypatch.setattr(email, "load_dotenv", lambda: None)
    if api_key is None:
        monkeypatch.delenv("RESEND_API_KEY", raising=False)
    else:
        monkeypatch.setenv("RESEND_API_KEY", api_key)
    if sender is None:
        monkeypatch.delenv("EMAIL_FROM", raising=False)
    else:
        monkeypatch.setenv("EMAIL_FROM", sender)

    with pytest.raises(email.EmailConfigurationError) as exc_info:
        asyncio.run(email.send_email("recipient@example.com", "Subject", "<p>Hi</p>"))

    assert str(exc_info.value) == "Email service is not configured."


def test_send_email_hides_resend_error_details(monkeypatch):
    monkeypatch.setattr(email, "load_dotenv", lambda: None)
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    monkeypatch.setenv("EMAIL_FROM", "Ledger <ledger@example.com>")
    send_async = AsyncMock(
        side_effect=ResendError(
            code=401,
            error_type="Unauthorized",
            message="sensitive-provider-detail",
            suggested_action="Do not reveal this detail",
        )
    )
    monkeypatch.setattr(email.resend.Emails, "send_async", send_async)

    with pytest.raises(email.EmailDeliveryError) as exc_info:
        asyncio.run(email.send_email("recipient@example.com", "Subject", "<p>Hi</p>"))

    assert str(exc_info.value) == "Email delivery failed."
    assert "sensitive-provider-detail" not in str(exc_info.value)


def test_send_email_hides_transport_error_details(monkeypatch):
    monkeypatch.setattr(email, "load_dotenv", lambda: None)
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    monkeypatch.setenv("EMAIL_FROM", "Ledger <ledger@example.com>")
    send_async = AsyncMock(side_effect=RuntimeError("sensitive transport detail"))
    monkeypatch.setattr(email.resend.Emails, "send_async", send_async)

    with pytest.raises(email.EmailDeliveryError) as exc_info:
        asyncio.run(email.send_email("recipient@example.com", "Subject", "<p>Hi</p>"))

    assert str(exc_info.value) == "Email delivery failed."
    assert "sensitive transport detail" not in str(exc_info.value)
