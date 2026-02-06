from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud
from app.db import get_session
from app.models import ForwardAccountConfig, User
from app.routers.auth import get_current_user
from app.schemas import (
    AccountOAuthStartResponse,
    ConnectedAccountCreate,
    ConnectedAccountOut,
    ForwardAccountInfo,
    OAuthCredentialConfigOut,
    OAuthCredentialConfigUpdate,
)
from app.services.forwarding import build_forward_address
from app.services.feed_urls import normalize_feed_url
from app.services.oauth_clients import build_authorization_url, exchange_code_for_tokens, fetch_identifier
from app.services.oauth_state import consume_state
from app.settings import settings
from app.sync import sync_account

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _rsshub_url(path: str) -> str:
    return f"{settings.rsshub_base_url.rstrip('/')}/{path.lstrip('/')}"


def _oauth_popup_html(payload: dict[str, object]) -> HTMLResponse:
    payload_json = json.dumps(payload, ensure_ascii=False)
    html = f"""<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>MercuryDesk OAuth</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 24px;">
    <p>授权完成，窗口即将关闭…</p>
    <script>
      (function () {{
        var payload = {payload_json};
        try {{
          if (window.opener) {{
            window.opener.postMessage(payload, "*");
            window.close();
          }} else {{
            window.location.href = {json.dumps(settings.frontend_url.rstrip("/") + "/settings")};
          }}
        }} catch (_e) {{
          window.location.href = {json.dumps(settings.frontend_url.rstrip("/") + "/settings")};
        }}
      }})();
    </script>
  </body>
</html>"""
    return HTMLResponse(content=html)


def _provider_env_client_id(provider: str) -> str | None:
    provider_norm = provider.lower().strip()
    if provider_norm == "gmail":
        value = (settings.gmail_client_id or "").strip()
        return value or None
    if provider_norm == "outlook":
        value = (settings.outlook_client_id or "").strip()
        return value or None
    if provider_norm == "github":
        value = (settings.github_client_id or "").strip()
        return value or None
    return None


def _mask_client_id(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    if len(text) <= 10:
        return f"{text[:2]}***"
    return f"{text[:6]}***{text[-4:]}"


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
    provider = {
        "blog": "rss",
        "feed": "rss",
        "twitter": "x",
        "gmail_oauth": "gmail",
        "outlook_oauth": "outlook",
        "github_oauth": "github",
    }.get(provider_raw, provider_raw)
    identifier = payload.identifier.strip() if payload.identifier else ""
    feed_url = payload.feed_url.strip() if payload.feed_url else None
    feed_homepage_url = payload.feed_homepage_url.strip() if payload.feed_homepage_url else None
    feed_display_name = payload.feed_display_name.strip() if payload.feed_display_name else None
    forward_secret: str | None = None

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
        feed_url = normalize_feed_url(feed_url)
        if not feed_homepage_url and feed_url.startswith("https://claude.com/blog"):
            feed_homepage_url = "https://claude.com/blog/"
        identifier = identifier or feed_display_name or feed_homepage_url or feed_url
    elif provider in {"gmail", "outlook", "github"}:
        if not payload.access_token:
            raise HTTPException(status_code=400, detail=f"{provider} 账户需要 access_token")
        if not identifier:
            raise HTTPException(status_code=400, detail=f"{provider} 账户需要 identifier")
    elif provider == "forward":
        source_email = (payload.forward_source_email or identifier).strip().lower()
        if not source_email:
            raise HTTPException(status_code=400, detail="转发接入需要填写邮箱地址")
        if "@" not in source_email or source_email.startswith("@") or source_email.endswith("@"):
            raise HTTPException(status_code=400, detail="请填写有效的邮箱地址")
        identifier = source_email
        forward_secret = secrets.token_urlsafe(32)

    final_identifier = identifier or payload.identifier
    try:
        account = crud.create_connected_account(
            db,
            user_id=current_user.id,
            provider=provider,
            identifier=final_identifier,
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
            forward_inbound_secret=forward_secret,
        )
    except IntegrityError:
        db.rollback()
        existing = crud.get_account_by_provider_identifier(
            db,
            user_id=current_user.id,
            provider=provider,
            identifier=final_identifier,
        )
        if existing is None:
            raise HTTPException(status_code=409, detail="账户已存在，请刷新页面后重试")
        account = existing
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return account


@router.get("/oauth/{provider}/start", response_model=AccountOAuthStartResponse)
def start_oauth(
    provider: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    provider_norm = provider.lower().strip()
    if provider_norm not in {"gmail", "outlook", "github"}:
        raise HTTPException(status_code=404, detail="OAuth provider not supported")
    credentials = crud.get_user_oauth_credentials(
        db,
        user_id=current_user.id,
        provider=provider_norm,
    )
    client_id, client_secret = credentials if credentials else (None, None)
    try:
        url = build_authorization_url(
            provider=provider_norm,
            user_id=current_user.id,
            client_id=client_id,
            client_secret=client_secret,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AccountOAuthStartResponse(provider=provider_norm, auth_url=url)


@router.get("/oauth/{provider}/callback", response_class=HTMLResponse)
def oauth_callback(
    provider: str,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_session),
):
    provider_norm = provider.lower().strip()
    if provider_norm not in {"gmail", "outlook", "github"}:
        return _oauth_popup_html({"source": "mercurydesk-oauth", "ok": False, "error": "不支持的 OAuth provider"})
    if error:
        return _oauth_popup_html({"source": "mercurydesk-oauth", "ok": False, "error": f"授权失败: {error}"})
    if not code or not state:
        return _oauth_popup_html({"source": "mercurydesk-oauth", "ok": False, "error": "缺少 code/state"})

    try:
        user_id = consume_state(token=state, provider=provider_norm)
        credentials = crud.get_user_oauth_credentials(
            db,
            user_id=user_id,
            provider=provider_norm,
        )
        client_id, client_secret = credentials if credentials else (None, None)
        access_token, refresh_token = exchange_code_for_tokens(
            provider=provider_norm,
            code=code,
            client_id=client_id,
            client_secret=client_secret,
        )
        identifier = fetch_identifier(provider=provider_norm, access_token=access_token)
        account = crud.upsert_oauth_account(
            db,
            user_id=user_id,
            provider=provider_norm,
            identifier=identifier,
            access_token=access_token,
            refresh_token=refresh_token,
        )
    except Exception as e:
        return _oauth_popup_html(
            {"source": "mercurydesk-oauth", "ok": False, "error": str(e)}
        )

    return _oauth_popup_html(
        {
            "source": "mercurydesk-oauth",
            "ok": True,
            "provider": provider_norm,
            "account_id": account.id,
            "identifier": account.identifier,
        }
    )


@router.get("/oauth/{provider}/config", response_model=OAuthCredentialConfigOut)
def get_oauth_config(
    provider: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    provider_norm = provider.lower().strip()
    if provider_norm not in {"gmail", "outlook", "github"}:
        raise HTTPException(status_code=404, detail="OAuth provider not supported")
    credentials = crud.get_user_oauth_credentials(
        db,
        user_id=current_user.id,
        provider=provider_norm,
    )
    if credentials is not None:
        client_id, _client_secret = credentials
        return OAuthCredentialConfigOut(
            provider=provider_norm,
            configured=True,
            client_id_hint=_mask_client_id(client_id),
        )
    env_client_id = _provider_env_client_id(provider_norm)
    return OAuthCredentialConfigOut(
        provider=provider_norm,
        configured=bool(env_client_id),
        client_id_hint=_mask_client_id(env_client_id),
    )


@router.patch("/oauth/{provider}/config", response_model=OAuthCredentialConfigOut)
def upsert_oauth_config(
    provider: str,
    payload: OAuthCredentialConfigUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    provider_norm = provider.lower().strip()
    if provider_norm not in {"gmail", "outlook", "github"}:
        raise HTTPException(status_code=404, detail="OAuth provider not supported")
    config = crud.upsert_user_oauth_credentials(
        db,
        user_id=current_user.id,
        provider=provider_norm,
        client_id=payload.client_id,
        client_secret=payload.client_secret,
    )
    return OAuthCredentialConfigOut(
        provider=provider_norm,
        configured=True,
        client_id_hint=_mask_client_id(config.client_id),
    )


@router.get("/{account_id}/forward-info", response_model=ForwardAccountInfo)
def get_forward_info(
    account_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    account = crud.get_account(db, user_id=current_user.id, account_id=account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.provider.lower() != "forward":
        raise HTTPException(status_code=400, detail="Not a forward account")
    config = db.get(ForwardAccountConfig, account.id)
    if config is None:
        raise HTTPException(status_code=404, detail="Forward config not found")
    forward_address = build_forward_address(
        account_id=account.id,
        inbound_secret=config.inbound_secret,
        domain=settings.forward_inbound_domain,
    )
    inbound_url = f"{settings.api_public_base_url.rstrip('/')}/api/v1/inbound/forward"
    return ForwardAccountInfo(
        account_id=account.id,
        provider=account.provider,
        identifier=account.identifier,
        source_email=account.identifier,
        forward_address=forward_address,
        inbound_url=inbound_url,
    )


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
