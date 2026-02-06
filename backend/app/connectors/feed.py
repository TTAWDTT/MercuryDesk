from __future__ import annotations

import calendar
import re
import time
from datetime import datetime, timezone
from html import unescape

import feedparser
import httpx

from app.connectors.base import IncomingMessage


def _to_datetime(value: object) -> datetime | None:
    if isinstance(value, time.struct_time):
        return datetime.fromtimestamp(calendar.timegm(value), tz=timezone.utc)
    return None


def _strip_html(text: str) -> str:
    # Feed summaries are often HTML fragments; strip tags for preview readability.
    without_tags = re.sub(r"<[^>]+>", " ", text or "")
    normalized = re.sub(r"\s+", " ", unescape(without_tags)).strip()
    return normalized


class FeedConnector:
    def __init__(
        self,
        *,
        feed_url: str,
        source: str,
        default_sender: str,
        timeout_seconds: int = 20,
        max_entries: int = 80,
    ):
        self._feed_url = feed_url
        self._source = source
        self._default_sender = default_sender
        self._timeout_seconds = max(5, timeout_seconds)
        self._max_entries = max(1, max_entries)

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        try:
            with httpx.Client(timeout=self._timeout_seconds, follow_redirects=True) as client:
                resp = client.get(self._feed_url)
            resp.raise_for_status()
        except Exception as e:
            raise ValueError(f"订阅源抓取失败: {e}") from e

        parsed = feedparser.parse(resp.content)
        feed_title = str(parsed.feed.get("title") or self._default_sender or "subscription")

        since_utc = since.astimezone(timezone.utc) if since else None
        messages: list[IncomingMessage] = []

        for entry in list(parsed.entries)[: self._max_entries]:
            published = (
                _to_datetime(entry.get("published_parsed"))
                or _to_datetime(entry.get("updated_parsed"))
                or datetime.now(timezone.utc)
            )
            if since_utc is not None and published <= since_utc:
                continue

            title = str(entry.get("title") or "新内容更新").strip()
            link = str(entry.get("link") or "").strip()
            summary_raw = str(entry.get("summary") or "")
            if not summary_raw:
                content = entry.get("content")
                if isinstance(content, list) and content:
                    summary_raw = str(content[0].get("value") or "")
            summary = _strip_html(summary_raw)[:2800]
            body = summary
            if link:
                body = f"{summary}\n\n原文链接: {link}".strip()

            sender = str(entry.get("author") or feed_title or self._default_sender).strip()
            external_id = str(entry.get("id") or link or f"{self._feed_url}:{title}:{published.isoformat()}").strip()

            messages.append(
                IncomingMessage(
                    source=self._source,
                    external_id=external_id[:255] if external_id else None,
                    sender=sender or self._default_sender,
                    subject=title[:998],
                    body=body,
                    received_at=published,
                )
            )

        return messages
