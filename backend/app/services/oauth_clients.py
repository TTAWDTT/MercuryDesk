from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal
from urllib.parse import parse_qs
from urllib.parse import urlencode

import httpx

from app.services.oauth_state import issue_state
from app.settings import settings

SupportedOAuthProvider = Literal["gmail", "outlook", "github"]


@dataclass(frozen=True)
class OAuthProviderConfig:
    provider: SupportedOAuthProvider
    authorize_url: str
    token_url: str
    scopes: tuple[str, ...]


_PROVIDERS: dict[str, OAuthProviderConfig] = {
    "gmail": OAuthProviderConfig(
        provider="gmail",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        scopes=(
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
        ),
    ),
    "outlook": OAuthProviderConfig(
        provider="outlook",
        authorize_url="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scopes=(
            "offline_access",
            "openid",
            "profile",
            "email",
            "User.Read",
            "Mail.Read",
        ),
    ),
    "github": OAuthProviderConfig(
        provider="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        scopes=(
            "notifications",
            "read:user",
            "user:email",
        ),
    ),
}


def _provider_config(provider: str) -> OAuthProviderConfig:
    provider_norm = provider.lower().strip()
    config = _PROVIDERS.get(provider_norm)
    if config is None:
        raise ValueError(f"不支持的 OAuth provider: {provider}")
    return config


def _redirect_uri(provider: str) -> str:
    return f"{settings.oauth_redirect_base_url.rstrip('/')}/api/v1/accounts/oauth/{provider}/callback"


def _client_credentials(
    provider: str,
    *,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> tuple[str, str]:
    provider_norm = provider.lower().strip()
    missing_hint = ""
    explicit_client_id = (client_id or "").strip()
    explicit_client_secret = (client_secret or "").strip()
    if explicit_client_id and explicit_client_secret:
        return explicit_client_id, explicit_client_secret

    if provider_norm == "gmail":
        client_id = (
            settings.gmail_client_id
            or os.getenv("GOOGLE_CLIENT_ID")
            or os.getenv("GMAIL_CLIENT_ID")
            or ""
        ).strip()
        client_secret = (
            settings.gmail_client_secret
            or os.getenv("GOOGLE_CLIENT_SECRET")
            or os.getenv("GMAIL_CLIENT_SECRET")
            or ""
        ).strip()
        missing_hint = "请设置 MERCURYDESK_GMAIL_CLIENT_ID 和 MERCURYDESK_GMAIL_CLIENT_SECRET"
    elif provider_norm == "outlook":
        client_id = (settings.outlook_client_id or "").strip()
        client_secret = (settings.outlook_client_secret or "").strip()
        missing_hint = "请设置 MERCURYDESK_OUTLOOK_CLIENT_ID 和 MERCURYDESK_OUTLOOK_CLIENT_SECRET"
    elif provider_norm == "github":
        client_id = (
            settings.github_client_id
            or os.getenv("GITHUB_CLIENT_ID")
            or ""
        ).strip()
        client_secret = (
            settings.github_client_secret
            or os.getenv("GITHUB_CLIENT_SECRET")
            or ""
        ).strip()
        missing_hint = "请设置 MERCURYDESK_GITHUB_CLIENT_ID 和 MERCURYDESK_GITHUB_CLIENT_SECRET"
    else:
        raise ValueError(f"不支持的 OAuth provider: {provider}")
    if not client_id or not client_secret:
        raise ValueError(
            f"{provider_norm} OAuth 未配置 client_id/client_secret。{missing_hint}；"
            "并确认后端已读取到环境变量（建议在 backend 目录启动，或在网页设置中保存 OAuth 凭据）。"
        )
    return client_id, client_secret


def build_authorization_url(
    *,
    provider: str,
    user_id: int,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> str:
    config = _provider_config(provider)
    client_id, _client_secret = _client_credentials(
        config.provider,
        client_id=client_id,
        client_secret=client_secret,
    )
    state = issue_state(user_id=user_id, provider=config.provider)
    redirect_uri = _redirect_uri(config.provider)

    params: dict[str, str] = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(config.scopes),
        "state": state,
    }
    if config.provider == "gmail":
        params["access_type"] = "offline"
        params["prompt"] = "consent"
        params["include_granted_scopes"] = "true"
    elif config.provider == "outlook":
        params["prompt"] = "select_account"
    elif config.provider == "github":
        params["allow_signup"] = "true"

    return f"{config.authorize_url}?{urlencode(params)}"


def exchange_code_for_tokens(
    *,
    provider: str,
    code: str,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> tuple[str, str | None]:
    config = _provider_config(provider)
    client_id, client_secret = _client_credentials(
        config.provider,
        client_id=client_id,
        client_secret=client_secret,
    )
    redirect_uri = _redirect_uri(config.provider)
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }
    headers = {}
    if config.provider != "github":
        payload["grant_type"] = "authorization_code"
    else:
        headers["Accept"] = "application/json"
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        resp = client.post(config.token_url, data=payload, headers=headers)
    if resp.status_code >= 400:
        raise ValueError(f"OAuth token exchange 失败: {resp.text[:500]}")
    try:
        data = resp.json()
    except ValueError:
        parsed = parse_qs(resp.text or "", keep_blank_values=True)
        data = {key: values[0] if values else "" for key, values in parsed.items()}
    error = str(data.get("error") or "").strip()
    if error:
        error_description = str(data.get("error_description") or data.get("error_uri") or "").strip()
        raise ValueError(f"OAuth token exchange 失败: {error} {error_description}".strip())
    access_token = str(data.get("access_token") or "").strip()
    refresh_token_raw = str(data.get("refresh_token") or "").strip()
    refresh_token = refresh_token_raw or None
    if not access_token:
        raise ValueError("OAuth token exchange 未返回 access_token")
    return access_token, refresh_token


def refresh_access_token(
    *,
    provider: str,
    refresh_token: str,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> tuple[str, str | None]:
    config = _provider_config(provider)
    if config.provider == "github":
        raise ValueError("GitHub OAuth token 不支持自动刷新，请重新授权连接")
    client_id, client_secret = _client_credentials(
        config.provider,
        client_id=client_id,
        client_secret=client_secret,
    )
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        resp = client.post(config.token_url, data=payload)
    if resp.status_code >= 400:
        raise ValueError(f"OAuth refresh 失败: {resp.text[:500]}")
    data = resp.json()
    access_token = str(data.get("access_token") or "").strip()
    next_refresh_raw = str(data.get("refresh_token") or "").strip()
    if not access_token:
        raise ValueError("OAuth refresh 未返回 access_token")
    return access_token, (next_refresh_raw or None)


def fetch_identifier(*, provider: str, access_token: str) -> str:
    provider_norm = provider.lower().strip()
    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        if provider_norm == "gmail":
            info_resp = client.get("https://openidconnect.googleapis.com/v1/userinfo", headers=headers)
            if info_resp.status_code < 400:
                data = info_resp.json()
                email = str(data.get("email") or "").strip()
                if email:
                    return email
            profile_resp = client.get("https://gmail.googleapis.com/gmail/v1/users/me/profile", headers=headers)
            if profile_resp.status_code >= 400:
                raise ValueError(f"获取 Gmail 账号信息失败: {profile_resp.text[:300]}")
            data = profile_resp.json()
            email = str(data.get("emailAddress") or "").strip()
            if not email:
                raise ValueError("Gmail 账号信息未返回 email")
            return email
        if provider_norm == "outlook":
            me_resp = client.get(
                "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
                headers=headers,
            )
            if me_resp.status_code >= 400:
                raise ValueError(f"获取 Outlook 账号信息失败: {me_resp.text[:300]}")
            data = me_resp.json()
            email = str(data.get("mail") or data.get("userPrincipalName") or "").strip()
            if not email:
                raise ValueError("Outlook 账号信息未返回邮箱")
            return email
        if provider_norm == "github":
            gh_headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            profile_resp = client.get("https://api.github.com/user", headers=gh_headers)
            if profile_resp.status_code >= 400:
                raise ValueError(f"获取 GitHub 账号信息失败: {profile_resp.text[:300]}")
            data = profile_resp.json()
            login = str(data.get("login") or "").strip()
            email = str(data.get("email") or "").strip()
            if login:
                return login
            if email:
                return email
            user_id = data.get("id")
            if user_id is not None:
                return f"github-user-{user_id}"
            raise ValueError("GitHub 账号信息未返回 login")
    raise ValueError(f"不支持的 OAuth provider: {provider}")
