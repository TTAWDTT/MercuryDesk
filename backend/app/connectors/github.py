from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.connectors.base import IncomingMessage


class GitHubNotificationsConnector:
    def __init__(self, token: str):
        self._token = token

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self._token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        params: dict[str, str] = {"all": "false", "participating": "false"}
        if since is not None:
            params["since"] = since.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

        with httpx.Client(timeout=20) as client:
            resp = client.get("https://api.github.com/notifications", headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

        messages: list[IncomingMessage] = []
        for item in data:
            updated_at = item.get("updated_at")
            received_at = (
                datetime.fromisoformat(updated_at.replace("Z", "+00:00")) if updated_at else datetime.now(timezone.utc)
            )
            repo = (item.get("repository") or {}).get("full_name") or "github"
            subject = ((item.get("subject") or {}).get("title")) or "GitHub notification"
            external_id = item.get("id")
            sender = repo
            body = ((item.get("subject") or {}).get("url")) or ""
            messages.append(
                IncomingMessage(
                    source="github",
                    external_id=str(external_id) if external_id is not None else None,
                    sender=sender,
                    subject=subject,
                    body=body,
                    received_at=received_at,
                )
            )
        return messages

