
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate


def add_transaction(
    db: Session,
    account_id: UUID,
    payload: TransactionCreate,
) -> tuple[Transaction, Decimal, bool]:
    try:
        # Lock the account so concurrent transactions cannot
        # spend the same balance.
        account = db.execute(
            select(Account)
            .where(Account.id == account_id)
            .with_for_update()
        ).scalar_one_or_none()

        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")

        # Check duplicate reference within this account.
        existing = db.execute(
            select(Transaction).where(
                Transaction.account_id == account_id,
                Transaction.reference_id == payload.reference_id,
            )
        ).scalar_one_or_none()

        if existing:
            db.commit()
            return existing, account.balance, True

        amount = payload.amount

        if payload.type == "debit" and account.balance < amount:
            raise HTTPException(
                status_code=422,
                detail="Insufficient balance",
            )

        transaction = Transaction(
            account_id=account_id,
            type=payload.type,
            amount=amount,
            description=payload.description,
            reference_id=payload.reference_id,
        )

        if payload.type == "credit":
            account.balance += amount
        else:
            account.balance -= amount

        db.add(transaction)
        db.flush()
        db.commit()
        db.refresh(transaction)
        db.refresh(account)

        return transaction, account.balance, False

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()

        # Handles a duplicate reference even if a competing request
        # inserted it first.
        existing = db.execute(
            select(Transaction).where(
                Transaction.account_id == account_id,
                Transaction.reference_id == payload.reference_id,
            )
        ).scalar_one_or_none()

        if existing:
            account = db.get(Account, account_id)
            return existing, account.balance, True

        raise HTTPException(
            status_code=409,
            detail="Transaction could not be created due to a database constraint",
        ) from exc
    except Exception:
        db.rollback()
        raise
