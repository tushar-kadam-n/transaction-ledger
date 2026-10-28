
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountResponse

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.post(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
):
    account = Account(name=payload.name.strip())

    db.add(account)
    db.commit()
    db.refresh(account)

    return account



from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select


@router.get("/{account_id}/balance")
def get_account_balance(
    account_id: UUID,
    db: Session = Depends(get_db),
):
    account = db.execute(
        select(Account).where(Account.id == account_id)
    ).scalar_one_or_none()

    if account is None:
        raise HTTPException(
            status_code=404,
            detail="Account not found",
        )

    return {
        "account_id": account.id,
        "balance": account.balance,
    }
