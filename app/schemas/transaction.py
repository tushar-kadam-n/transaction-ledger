
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.time_utils import to_utc


class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["credit", "debit"]
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    description: str = Field(min_length=1, max_length=2000)
    reference_id: str = Field(min_length=1, max_length=255)
    transaction_date: datetime

    @field_validator("transaction_date")
    @classmethod
    def normalize_transaction_date(cls, value: datetime) -> datetime:
        return to_utc(value)


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID
    type: Literal["credit", "debit"]
    amount: Decimal
    description: str
    reference_id: str
    transaction_date: datetime
    created_at: datetime

    @field_serializer("transaction_date", "created_at")
    def serialize_timestamps_as_utc(self, value: datetime) -> str:
        return to_utc(value).isoformat()


class TransactionHistoryItemResponse(TransactionResponse):
    account_name: str
