from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db import get_session
from app.models import User
from app.routers.auth import get_current_user
from app.schemas import ConnectedAccountCreate, ConnectedAccountOut
from app.settings import settings
from app.sync import sync_account

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _rsshub_url(path: str) -> str:
    return f"{settings.rsshub_base_url.rstrip('/')}/{path.lstrip('/')}"


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
    provider_raw = payload.provider.lower().strip()
    provider = {"blog": "rss", "feed": "rss", "twitter": "x"}.get(provider_raw, provider_raw)
    identifier = payload.identifier.strip() if payload.identifier else ""
    feed_url = payload.feed_url.strip() if payload.feed_url else None
    feed_homepage_url = payload.feed_homepage_url.strip() if payload.feed_homepage_url else None
    feed_display_name = payload.feed_display_name.strip() if payload.feed_display_name else None

    if provider == "bilibili":
        uid = (payload.bilibili_uid or identifier).strip()
        if not uid:
            raise HTTPException(status_code=400, detail="bilibili 订阅需要 UID")
        if not feed_url:
            feed_url = _rsshub_url(f"/bilibili/user/dynamic/{uid}")
        if not feed_homepage_url:
            feed_homepage_url = f"https://space.bilibili.com/{uid}"
        if not feed_display_name:
            feed_display_name = f"B站 UP {uid}"
        identifier = identifier or f"bilibili:{uid}"
    elif provider == "x":
        username = (payload.x_username or identifier).strip().lstrip("@")
        if not username:
            raise HTTPException(status_code=400, detail="X 订阅需要用户名")
        if not feed_url:
            feed_url = _rsshub_url(f"/x/user/{username}")
        if not feed_homepage_url:
            feed_homepage_url = f"https://x.com/{username}"
        if not feed_display_name:
            feed_display_name = f"X @{username}"
        identifier = identifier or f"x:{username}"
    elif provider == "rss":
        if not feed_url:
            raise HTTPException(status_code=400, detail="RSS/Blog 订阅需要 feed_url")
        identifier = identifier or feed_display_name or feed_homepage_url or feed_url

    try:
        account = crud.create_connected_account(
            db,
            user_id=current_user.id,
            provider=provider,
            identifier=identifier or payload.identifier,
            access_token=payload.access_token,
            refresh_token=payload.refresh_token,
            imap_host=payload.imap_host,
            imap_port=payload.imap_port,
            imap_use_ssl=payload.imap_use_ssl,
            imap_username=payload.imap_username,
            imap_password=payload.imap_password,
            imap_mailbox=payload.imap_mailbox,
            feed_url=feed_url,
            feed_homepage_url=feed_homepage_url,
            feed_display_name=feed_display_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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


@router.delete("/{account_id}", status_code=204)
def delete_connected_account(
    account_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = crud.delete_connected_account(db, user_id=current_user.id, account_id=account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
