
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.ledger import add_transaction
from fastapi.responses import JSONResponse
router = APIRouter(prefix="/api/accounts", tags=["Transactions"])


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

@router.get("/{account_id}/transactions")
def get_transaction_history(
    account_id: UUID,
    type: Literal["credit", "debit"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    account = db.get(Account, account_id)

    if account is None:
        raise HTTPException(
            status_code=404,
            detail="Account not found",
        )

    statement = select(Transaction).where(
        Transaction.account_id == account_id
    )

    count_statement = (
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.account_id == account_id)
    )

    if type is not None:
        statement = statement.where(
            Transaction.type == type
        )
        count_statement = count_statement.where(
            Transaction.type == type
        )

    total_records = db.execute(
        count_statement
    ).scalar_one()

    statement = statement.order_by(
        Transaction.created_at.desc(),
        Transaction.id.desc(),
    )

    statement = statement.offset(
        (page - 1) * limit
    ).limit(limit)

    transactions = db.execute(
        statement
    ).scalars().all()

    total_pages = (
        total_records + limit - 1
    ) // limit

    return {
        "account_id": account_id,
        "page": page,
        "limit": limit,
        "total_records": total_records,
        "total_pages": total_pages,
        "transactions": [
            TransactionResponse.model_validate(tx)
            for tx in transactions
        ],
    }
