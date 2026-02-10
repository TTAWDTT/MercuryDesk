from __future__ import annotations

import json
import secrets
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud
from app.db import get_session
from app.models import ForwardAccountConfig, User, XApiConfig
from app.routers.auth import get_current_user
from app.schemas import (
    AccountOAuthStartResponse,
    ConnectedAccountCreate,
    ConnectedAccountOut,
    ForwardAccountInfo,
    OAuthCredentialConfigOut,
    OAuthCredentialConfigUpdate,
    SyncJobStartResponse,
    SyncJobStatusResponse,
)
from app.services.encryption import decrypt_optional, encrypt_optional
from app.services.forwarding import build_forward_address
from app.services.feed_urls import normalize_feed_url
from app.services.oauth_clients import build_authorization_url, exchange_code_for_tokens, fetch_identifier
from app.services.oauth_state import consume_state
from app.services.sync_jobs import enqueue_sync_job, get_sync_job
from app.settings import settings
from app.connectors.douyin import _extract_sec_uid as extract_douyin_uid
from app.connectors.xiaohongshu import _extract_user_id as extract_xhs_uid
from app.connectors.weibo import _extract_uid as extract_weibo_uid

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _rsshub_url(path: str) -> str:
    return f"{settings.rsshub_base_url.rstrip('/')}/{path.lstrip('/')}"


def _frontend_origin() -> str:
    parsed = urlparse(settings.frontend_url)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return settings.frontend_url.rstrip("/")


def _oauth_popup_html(payload: dict[str, object]) -> HTMLResponse:
    payload_json = json.dumps(payload, ensure_ascii=False)
    settings_url_json = json.dumps(settings.frontend_url.rstrip("/") + "/settings")
    frontend_origin_json = json.dumps(_frontend_origin())
    html = f"""<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>MercuryDesk OAuth</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 24px;">
    <div id="status">授权处理中…</div>
    <script>
      (function () {{
        var payload = {payload_json};
        var settingsUrl = {settings_url_json};
        var frontendOrigin = {frontend_origin_json};
        var isOk = !!payload.ok;
        var title = isOk ? "授权完成" : "授权失败";
        var message = payload.error ? String(payload.error) : (isOk ? "你可以返回 MercuryDesk 继续操作。" : "请返回 MercuryDesk 重试。");
        try {{
          if (window.opener && !window.opener.closed) {{
            window.opener.postMessage(payload, frontendOrigin);
            window.close();
            return;
          }}
        }} catch (_e) {{
          // ignore and fallback to inline message
        }}
        var root = document.getElementById("status");
        if (!root) return;
        var color = isOk ? "#065f46" : "#b91c1c";
        var background = isOk ? "#ecfdf5" : "#fef2f2";
        var border = isOk ? "#a7f3d0" : "#fecaca";
        root.innerHTML =
          '<div style="max-width:640px;border:1px solid ' + border + ';background:' + background + ';color:' + color + ';padding:16px;border-radius:12px;line-height:1.6;">' +
            '<h3 style="margin:0 0 8px;">' + title + '</h3>' +
            '<div style="margin:0 0 12px;word-break:break-word;">' + message + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
              '<a href="' + settingsUrl + '" style="display:inline-block;padding:8px 12px;border-radius:8px;border:1px solid ' + border + ';text-decoration:none;color:inherit;background:#fff;">返回设置页</a>' +
              '<button onclick="window.close()" style="padding:8px 12px;border-radius:8px;border:1px solid ' + border + ';background:#fff;cursor:pointer;">关闭窗口</button>' +
            '</div>' +
          '</div>';
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
    elif provider == "douyin":
        sec_uid = extract_douyin_uid(identifier)
        if not sec_uid:
            raise HTTPException(status_code=400, detail="抖音订阅需要有效 sec_uid")
        if not feed_url:
            feed_url = _rsshub_url(f"/douyin/user/{sec_uid}")
        if not feed_homepage_url:
            feed_homepage_url = f"https://www.douyin.com/user/{sec_uid}"
        if not feed_display_name:
            feed_display_name = f"抖音用户"
        identifier = sec_uid
    elif provider == "xiaohongshu":
        user_id = extract_xhs_uid(identifier)
        if not user_id:
            raise HTTPException(status_code=400, detail="小红书订阅需要有效 user_id")
        if not feed_url:
            feed_url = _rsshub_url(f"/xiaohongshu/user/{user_id}")
        if not feed_homepage_url:
            feed_homepage_url = f"https://www.xiaohongshu.com/user/profile/{user_id}"
        if not feed_display_name:
            feed_display_name = f"小红书用户"
        identifier = user_id
    elif provider == "weibo":
        uid = extract_weibo_uid(identifier)
        if not uid:
            raise HTTPException(status_code=400, detail="微博订阅需要有效 UID")
        if not feed_url:
            feed_url = _rsshub_url(f"/weibo/user/{uid}")
        if not feed_homepage_url:
            feed_homepage_url = f"https://weibo.com/u/{uid}"
        if not feed_display_name:
            feed_display_name = f"微博用户"
        identifier = uid
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

        # Self-healing: Ensure feed config exists for feed-based providers
        if provider in {"rss", "bilibili", "x", "douyin", "xiaohongshu", "weibo"}:
            crud.ensure_feed_account_config(
                db,
                account_id=existing.id,
                feed_url=feed_url,
                homepage_url=feed_homepage_url,
                display_name=feed_display_name,
            )

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


@router.post("/{account_id}/sync", response_model=SyncJobStartResponse, status_code=202)
def sync_connected_account(
    account_id: int,
    force_full: bool = False,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    account = crud.get_account(db, user_id=current_user.id, account_id=account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    job = enqueue_sync_job(user_id=current_user.id, account_id=account.id, force_full=force_full)
    return SyncJobStartResponse(job_id=job.job_id, status=job.status, account_id=job.account_id)


@router.get("/sync-jobs/{job_id}", response_model=SyncJobStatusResponse)
def get_sync_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    job = get_sync_job(job_id=job_id, user_id=current_user.id)
    if job is None:
        raise HTTPException(status_code=404, detail="Sync job not found")
    return SyncJobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        account_id=job.account_id,
        inserted=job.inserted,
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


@router.delete("/{account_id}", status_code=204)
def delete_connected_account(
    account_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = crud.delete_connected_account(db, user_id=current_user.id, account_id=account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")


# ============================================================
# X API Configuration
# ============================================================

@router.get("/x/config")
def get_x_api_config(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get X API configuration status"""
    config = db.query(XApiConfig).filter(XApiConfig.user_id == current_user.id).first()
    token = (decrypt_optional(config.bearer_token) if config else "") or ""
    cookies_configured = False
    if config and config.auth_cookies:
        import json as _json
        try:
            cookie_payload = decrypt_optional(config.auth_cookies) or ""
            c = _json.loads(cookie_payload) if cookie_payload else {}
            cookies_configured = bool(c.get("auth_token") and c.get("ct0"))
        except Exception:
            pass
    return {
        "configured": bool(token),
        "token_hint": (token[:8] + "..." + token[-4:]) if len(token) > 12 else None,
        "cookies_configured": cookies_configured,
    }


@router.patch("/x/config")
def update_x_api_config(
    payload: dict,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update X API Bearer Token (saves to database)"""
    bearer_token = (payload.get("bearer_token") or "").strip()
    if not bearer_token:
        raise HTTPException(status_code=400, detail="bearer_token is required")

    # Get or create config
    config = db.query(XApiConfig).filter(XApiConfig.user_id == current_user.id).first()
    if not config:
        config = XApiConfig(
            user_id=current_user.id,
            bearer_token=encrypt_optional(bearer_token) or bearer_token,
        )
        db.add(config)
    else:
        config.bearer_token = encrypt_optional(bearer_token) or bearer_token

    db.commit()

    return {
        "configured": True,
        "token_hint": (bearer_token[:8] + "..." + bearer_token[-4:]) if len(bearer_token) > 12 else None,
        "message": "X API Bearer Token 已保存到数据库。",
    }


@router.patch("/x/cookies")
def update_x_auth_cookies(
    payload: dict,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update X auth cookies (auth_token + ct0) for authenticated GraphQL access"""
    import json as _json

    auth_token = (payload.get("auth_token") or "").strip()
    ct0 = (payload.get("ct0") or "").strip()

    if not auth_token or not ct0:
        raise HTTPException(status_code=400, detail="auth_token and ct0 are both required")

    cookies_json = _json.dumps({"auth_token": auth_token, "ct0": ct0})

    config = db.query(XApiConfig).filter(XApiConfig.user_id == current_user.id).first()
    if not config:
        config = XApiConfig(
            user_id=current_user.id,
            auth_cookies=encrypt_optional(cookies_json) or cookies_json,
        )
        db.add(config)
    else:
        config.auth_cookies = encrypt_optional(cookies_json) or cookies_json

    db.commit()

    return {
        "cookies_configured": True,
        "message": "X 认证 Cookies 已保存。将优先使用 Cookie 认证获取最新推文。",
    }


@router.delete("/x/cookies")
def delete_x_auth_cookies(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete X auth cookies"""
    config = db.query(XApiConfig).filter(XApiConfig.user_id == current_user.id).first()
    if config and config.auth_cookies:
        config.auth_cookies = None
        db.commit()
    return {"cookies_configured": False, "message": "X 认证 Cookies 已删除。"}
