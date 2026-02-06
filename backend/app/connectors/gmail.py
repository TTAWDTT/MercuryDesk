from __future__ import annotations

import base64
from datetime import datetime, timezone
from email.utils import parseaddr, parsedate_to_datetime
from typing import Any

import httpx

from app.connectors.base import IncomingMessage


def _header_map(headers: list[dict[str, Any]] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for header in headers or []:
        name = str(header.get("name") or "").strip()
        if not name:
            continue
        out[name.lower()] = str(header.get("value") or "")
    return out


def _decode_base64url(value: str) -> str:
    if not value:
        return ""
    padding = "=" * ((4 - len(value) % 4) % 4)
    raw = base64.urlsafe_b64decode((value + padding).encode("utf-8"))
    return raw.decode("utf-8", errors="ignore")


def _extract_plain(payload: dict[str, Any] | None) -> str:
    if not payload:
        return ""
    mime_type = str(payload.get("mimeType") or "")
    body_data = payload.get("body") if isinstance(payload.get("body"), dict) else {}
    body_encoded = str(body_data.get("data") or "")
    if mime_type == "text/plain" and body_encoded:
        return _decode_base64url(body_encoded).strip()

    parts = payload.get("parts")
    if isinstance(parts, list):
        for part in parts:
            if not isinstance(part, dict):
                continue
            text = _extract_plain(part)
            if text:
                return text
    if body_encoded:
        return _decode_base64url(body_encoded).strip()
    return ""


def _to_datetime(value: str | None, fallback_ms: str | None) -> datetime:
    if value:
        try:
            dt = parsedate_to_datetime(value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            pass
    if fallback_ms:
        try:
            return datetime.fromtimestamp(int(fallback_ms) / 1000, tz=timezone.utc)
        except Exception:
            pass
    return datetime.now(timezone.utc)


class GmailConnector:
    def __init__(self, *, access_token: str, max_messages: int = 80):
        self._access_token = access_token
        self._max_messages = max(1, int(max_messages))

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        since_utc = since.astimezone(timezone.utc) if since else None
        query = ""
        if since_utc is not None:
            query = f"after:{since_utc.strftime('%Y/%m/%d')}"

        headers = {"Authorization": f"Bearer {self._access_token}"}
        params = {"maxResults": str(self._max_messages)}
        if query:
            params["q"] = query

        with httpx.Client(timeout=20, follow_redirects=True) as client:
            list_resp = client.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", headers=headers, params=params)
            if list_resp.status_code == 401:
                raise ValueError("Gmail 授权已失效，请重新授权")
            if list_resp.status_code >= 400:
                raise ValueError(f"Gmail 拉取失败: {list_resp.text[:300]}")
            list_data = list_resp.json()
            refs = list_data.get("messages")
            if not isinstance(refs, list):
                return []

            incoming: list[IncomingMessage] = []
            for ref in refs:
                if not isinstance(ref, dict):
                    continue
                message_id = str(ref.get("id") or "").strip()
                if not message_id:
                    continue
                detail_resp = client.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if detail_resp.status_code >= 400:
                    continue
                detail = detail_resp.json()
                payload = detail.get("payload") if isinstance(detail.get("payload"), dict) else {}
                headers_map = _header_map(payload.get("headers") if isinstance(payload, dict) else None)
                from_value = headers_map.get("from", "")
                sender_name, sender_email = parseaddr(from_value)
                sender = sender_email or sender_name or "unknown"
                subject = headers_map.get("subject", "")
                body = _extract_plain(payload)
                if not body:
                    body = str(detail.get("snippet") or "")
                received_at = _to_datetime(headers_map.get("date"), str(detail.get("internalDate") or ""))
                if since_utc is not None and received_at <= since_utc:
                    continue
                incoming.append(
                    IncomingMessage(
                        source="email",
                        external_id=message_id,
                        sender=sender,
                        subject=subject[:998],
                        body=body,
                        received_at=received_at,
                    )
                )
        return incoming
