
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountResponse
from app.models.user import User
from app.services.authentication import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.post(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_account(
    payload: AccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = Account(
        user_id=user.id,
        name=payload.name,
        account_type=payload.account_type,
        email=payload.email,
        phone=payload.phone,
        description=payload.description,
    )

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user.id)
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



@router.get("", response_model=list[AccountResponse])
def list_accounts(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accounts = db.scalars(
        select(Account).where(Account.user_id == user.id).order_by(Account.created_at.desc())
    ).all()

    return accounts
