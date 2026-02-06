from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from app.connectors.base import IncomingMessage
from app.services.avatar import gravatar_url_for_email


def _strip_html(text: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


def _parse_dt(value: str | None) -> datetime:
    raw = (value or "").strip()
    if not raw:
        return datetime.now(timezone.utc)
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


class OutlookConnector:
    def __init__(self, *, access_token: str, max_messages: int = 80):
        self._access_token = access_token
        self._max_messages = max(1, int(max_messages))

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        since_utc = since.astimezone(timezone.utc) if since else None
        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Accept": "application/json",
            "Prefer": 'outlook.body-content-type="text"',
        }
        params: dict[str, str] = {
            "$top": str(self._max_messages),
            "$orderby": "receivedDateTime desc",
            "$select": "id,subject,from,receivedDateTime,bodyPreview,body",
        }
        if since_utc is not None:
            params["$filter"] = f"receivedDateTime ge {since_utc.isoformat().replace('+00:00', 'Z')}"

        with httpx.Client(timeout=20, follow_redirects=True) as client:
            resp = client.get(
                "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages",
                headers=headers,
                params=params,
            )
            if resp.status_code == 401:
                raise ValueError("Outlook 授权已失效，请重新授权")
            if resp.status_code >= 400:
                raise ValueError(f"Outlook 拉取失败: {resp.text[:300]}")
            data = resp.json()
            values = data.get("value")
            if not isinstance(values, list):
                return []

            messages: list[IncomingMessage] = []
            for item in values:
                if not isinstance(item, dict):
                    continue
                external_id = str(item.get("id") or "").strip()
                if not external_id:
                    continue
                sender_obj: Any = item.get("from") or {}
                sender_address = (
                    sender_obj.get("emailAddress", {}).get("address")
                    if isinstance(sender_obj, dict)
                    else None
                )
                sender_name = (
                    sender_obj.get("emailAddress", {}).get("name")
                    if isinstance(sender_obj, dict)
                    else None
                )
                sender = str(sender_address or sender_name or "unknown")
                sender_avatar_url = gravatar_url_for_email(sender_address or sender)
                subject = str(item.get("subject") or "").strip()
                body = str(item.get("bodyPreview") or "").strip()
                body_obj = item.get("body")
                if isinstance(body_obj, dict):
                    content = str(body_obj.get("content") or "")
                    if content:
                        body = _strip_html(content)
                received_at = _parse_dt(str(item.get("receivedDateTime") or ""))
                if since_utc is not None and received_at <= since_utc:
                    continue
                messages.append(
                    IncomingMessage(
                        source="email",
                        external_id=external_id,
                        sender=sender,
                        subject=subject[:998],
                        body=body,
                        received_at=received_at,
                        sender_avatar_url=sender_avatar_url,
                    )
                )
        return messages
