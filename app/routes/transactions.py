
from typing import Literal
from datetime import date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.schemas.transaction import (
    TransactionCreate,
    TransactionHistoryItemResponse,
    TransactionResponse,
)
from app.services.ledger import add_transaction
from fastapi.responses import JSONResponse
router = APIRouter(prefix="/api/accounts", tags=["Transactions"])
global_router = APIRouter(prefix="/api", tags=["Transactions"])


@router.post(
    "/{account_id}/transactions",
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    account_id: UUID,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
):
    transaction, balance, duplicate = add_transaction(
        db,
        account_id,
        payload,
    )
    
    if duplicate:
        return JSONResponse(
            status_code=200,
            content={
                "message": "Transaction already exists",
                "duplicate": True,
                "transaction": TransactionResponse.model_validate(
                    transaction
                ).model_dump(mode="json"),
                "balance": str(balance),
            },
        )

    return JSONResponse(
        status_code=201,
        content={
            "message": "Transaction created successfully",
            "duplicate": False,
            "transaction": TransactionResponse.model_validate(
                transaction
            ).model_dump(mode="json"),
            "balance": str(balance),
        },
    )

def _query_transaction_history(
    db: Session,
    account_id: UUID | None,
    type: Literal["credit", "debit"] | None,
    page: int = 1,
    limit: int = 10,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    if account_id is not None and db.get(Account, account_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Account not found",
        )

    statement = select(Transaction, Account.name).join(
        Account, Transaction.account_id == Account.id
    )
    count_statement = select(func.count()).select_from(Transaction).join(
        Account, Transaction.account_id == Account.id
    )

    if account_id is not None:
        statement = statement.where(Transaction.account_id == account_id)
        count_statement = count_statement.where(
            Transaction.account_id == account_id
        )

    if type is not None:
        statement = statement.where(Transaction.type == type)
        count_statement = count_statement.where(Transaction.type == type)

    if search:
        search_pattern = f"%{search}%"
        search_filter = or_(
            Transaction.description.ilike(search_pattern),
            Transaction.reference_id.ilike(search_pattern),
            Account.name.ilike(search_pattern),
        )
        statement = statement.where(search_filter)
        count_statement = count_statement.where(search_filter)

    if start_date is not None:
        start_boundary = datetime.combine(start_date, time.min)
        statement = statement.where(Transaction.transaction_date >= start_boundary)
        count_statement = count_statement.where(
            Transaction.transaction_date >= start_boundary
        )

    if end_date is not None:
        end_boundary = datetime.combine(end_date + timedelta(days=1), time.min)
        statement = statement.where(Transaction.transaction_date < end_boundary)
        count_statement = count_statement.where(
            Transaction.transaction_date < end_boundary
        )

    total_records = db.execute(count_statement).scalar_one()
    rows = db.execute(
        statement
        .order_by(Transaction.created_at.desc(), Transaction.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    return {
        "page": page,
        "limit": limit,
        "total_records": total_records,
        "total_pages": (total_records + limit - 1) // limit,
        "rows": rows,
    }


@global_router.get("/transactions")
def get_all_transaction_history(
    account_id: UUID | None = Query(default=None),
    type: Literal["credit", "debit"] | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    history = _query_transaction_history(
        db, account_id, type, page, limit, search, start_date, end_date
    )

    return {
        "page": history["page"],
        "limit": history["limit"],
        "total_records": history["total_records"],
        "total_pages": history["total_pages"],
        "transactions": [
            TransactionHistoryItemResponse.model_validate(
                {
                    **TransactionResponse.model_validate(
                        transaction
                    ).model_dump(),
                    "account_name": account_name,
                }
            )
            for transaction, account_name in history["rows"]
        ],
    }


@router.get("/{account_id}/transactions")
def get_transaction_history(
    account_id: UUID,
    type: Literal["credit", "debit"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    history = _query_transaction_history(db, account_id, type, page, limit)

    return {
        "account_id": account_id,
        "page": history["page"],
        "limit": history["limit"],
        "total_records": history["total_records"],
        "total_pages": history["total_pages"],
        "transactions": [
            TransactionResponse.model_validate(transaction)
            for transaction, _account_name in history["rows"]
        ],
    }
