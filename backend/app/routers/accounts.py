from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db import get_session
from app.models import User
from app.routers.auth import get_current_user
from app.schemas import ConnectedAccountCreate, ConnectedAccountOut
from app.sync import sync_account

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[ConnectedAccountOut])
def list_connected_accounts(
    db: Session = Depends(get_session), current_user: User = Depends(get_current_user)
):
    return crud.list_accounts(db, user_id=current_user.id)


@router.post("", response_model=ConnectedAccountOut)
def add_connected_account(
    payload: ConnectedAccountCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    account = crud.create_connected_account(
        db,
        user_id=current_user.id,
        provider=payload.provider,
        identifier=payload.identifier,
        access_token=payload.access_token,
        refresh_token=payload.refresh_token,
    )
    return account


@router.post("/{account_id}/sync")
def sync_connected_account(
    account_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    account = crud.get_account(db, user_id=current_user.id, account_id=account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        inserted = sync_account(db, account=account)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"inserted": inserted, "account_id": account.id}
