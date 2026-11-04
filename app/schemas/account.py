
import uuid
from datetime import datetime
from decimal import Decimal
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


AccountType = Literal["savings", "current", "cash", "digital_wallet", "business"]


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=150)
    account_type: AccountType
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "email", "phone", "description", mode="before")
    @classmethod
    def trim_text_fields(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value or None if isinstance(value, str) and value == "" else value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        if value is not None and not re.fullmatch(
            r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
            r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
            r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+",
            value,
        ):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        if value is not None:
            digits = re.sub(r"\D", "", value)
            if (
                not re.fullmatch(r"\+?[0-9][0-9\s().-]*", value)
                or not 7 <= len(digits) <= 15
            ):
                raise ValueError("Enter a valid phone number.")
        return value

    @model_validator(mode="after")
    def require_contact_detail(self):
        if not self.email and not self.phone:
            raise ValueError("Provide an email address or phone number.")
        return self


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    account_type: AccountType
    email: str | None
    phone: str | None
    description: str | None
    balance: Decimal
    created_at: datetime
