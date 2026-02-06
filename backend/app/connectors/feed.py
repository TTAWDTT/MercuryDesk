from __future__ import annotations

import calendar
import re
import time
from datetime import datetime, timezone
from html import escape, unescape
from urllib.parse import urljoin

import feedparser
import httpx

from app.connectors.base import IncomingMessage
from app.services.avatar import normalize_http_avatar_url

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_IMAGE_RE = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>", flags=re.IGNORECASE)
_META_TAG_RE = re.compile(r"<meta\b[^>]*>", flags=re.IGNORECASE)
_ATTR_RE = re.compile(r"([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s\"'=<>`]+)")
_IMAGE_EXT_RE = re.compile(r"\.(?:avif|webp|png|jpe?g|gif|bmp|svg)(?:[?#].*)?$", flags=re.IGNORECASE)
_HTTP_SCHEME_RE = re.compile(r"^https?://", flags=re.IGNORECASE)
_IMAGE_HOST_HINTS = ("hdslb.com", "biliimg.com", "twimg.com", "imgur.com", "imgix.net", "images", "image")


def _to_datetime(value: object) -> datetime | None:
    if isinstance(value, time.struct_time):
        return datetime.fromtimestamp(calendar.timegm(value), tz=timezone.utc)
    return None


def _strip_html(text: str) -> str:
    # Feed summaries are often HTML fragments; strip tags for preview readability.
    without_tags = _HTML_TAG_RE.sub(" ", text or "")
    normalized = re.sub(r"\s+", " ", unescape(without_tags)).strip()
    return normalized


def _normalize_http_url(value: object, *, base_url: str | None = None) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = unescape(value).strip()
    if not candidate:
        return None
    if base_url:
        candidate = urljoin(base_url, candidate)
    if _HTTP_SCHEME_RE.match(candidate):
        return candidate
    return None


def _extract_meta_content(html: str, *keys: str) -> str | None:
    if not html:
        return None
    wanted = {key.lower() for key in keys}
    for tag in _META_TAG_RE.findall(html):
        attrs: dict[str, str] = {}
        for matched in _ATTR_RE.finditer(tag):
            key = matched.group(1).lower().strip()
            value = matched.group(2).strip().strip("'\"")
            attrs[key] = unescape(value)
        name_or_property = (attrs.get("property") or attrs.get("name") or "").lower().strip()
        if not name_or_property or name_or_property not in wanted:
            continue
        content = attrs.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return None


def _extract_first_image_from_html(html: str, *, base_url: str | None = None) -> str | None:
    if not html:
        return None
    matched = _HTML_IMAGE_RE.search(html)
    if not matched:
        return None
    return _normalize_http_url(matched.group(1), base_url=base_url)


def _looks_like_image_url(url: str) -> bool:
    lowered = url.lower()
    if _IMAGE_EXT_RE.search(lowered):
        return True
    if any(hint in lowered for hint in _IMAGE_HOST_HINTS):
        return True
    if "format=jpg" in lowered or "format=jpeg" in lowered or "format=png" in lowered or "format=webp" in lowered:
        return True
    return False


def _extract_entry_image(entry: object, *, base_url: str | None = None) -> str | None:
    if not hasattr(entry, "get"):
        return None

    def _iter_urls(items: object, *, allow_without_image_type: bool = True) -> str | None:
        if not isinstance(items, list):
            return None
        for item in items:
            if not hasattr(item, "get"):
                continue
            image_type = str(item.get("type") or "").lower().strip()
            if image_type and not image_type.startswith("image/") and not allow_without_image_type:
                continue
            candidate = (
                item.get("url")
                or item.get("href")
                or item.get("src")
                or item.get("content")
            )
            normalized = _normalize_http_url(candidate, base_url=base_url)
            if normalized:
                if _looks_like_image_url(normalized) or image_type.startswith("image/"):
                    return normalized
        return None

    for key in ("media_content", "media_thumbnail", "enclosures"):
        normalized = _iter_urls(entry.get(key), allow_without_image_type=(key != "enclosures"))
        if normalized:
            return normalized
    normalized_link = _iter_urls(entry.get("links"), allow_without_image_type=False)
    if normalized_link:
        return normalized_link
    return None


def _build_preview_html(
    *,
    title: str,
    description: str,
    link: str,
    preview_image: str | None,
) -> str:
    title_safe = escape(title.strip() or "新内容更新")
    description_safe = escape(description.strip()) if description else ""
    link_safe = escape(link.strip(), quote=True) if link else ""
    image_safe = escape(preview_image.strip(), quote=True) if preview_image else ""

    parts = [
        '<article class="md-link-preview">',
        f'<meta property="og:title" content="{title_safe}" />',
    ]
    if description_safe:
        parts.append(f'<meta property="og:description" content="{description_safe}" />')
    if link_safe:
        parts.append(f'<meta property="og:url" content="{link_safe}" />')
    if image_safe:
        parts.append(f'<meta property="og:image" content="{image_safe}" />')
        parts.append(f'<img src="{image_safe}" alt="{title_safe}" />')

    parts.append(f"<h3>{title_safe}</h3>")
    if description_safe:
        parts.append(f"<p>{description_safe}</p>")
    if link_safe:
        parts.append(
            '<p><a href="'
            + link_safe
            + '" target="_blank" rel="noopener noreferrer">查看原文</a></p>'
        )
    parts.append("</article>")
    return "".join(parts)


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

    def _fetch_open_graph_metadata(self, *, client: httpx.Client, page_url: str) -> dict[str, str]:
        normalized_page_url = _normalize_http_url(page_url)
        if not normalized_page_url:
            return {}
        try:
            response = client.get(
                normalized_page_url,
                timeout=max(3, min(8, self._timeout_seconds)),
                headers={"Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"},
            )
            response.raise_for_status()
        except Exception:
            return {}

        content_type = response.headers.get("content-type", "").lower()
        if "html" not in content_type:
            return {}

        html = (response.text or "")[:250_000]
        if not html:
            return {}

        base_url = str(response.url)
        title = _extract_meta_content(html, "og:title", "twitter:title")
        description = _extract_meta_content(
            html,
            "og:description",
            "twitter:description",
            "description",
        )
        image = _extract_meta_content(
            html,
            "og:image",
            "og:image:url",
            "twitter:image",
            "twitter:image:src",
        )
        url = _extract_meta_content(html, "og:url")

        normalized_image = _normalize_http_url(image, base_url=base_url) if image else None
        normalized_url = _normalize_http_url(url, base_url=base_url) if url else None

        result: dict[str, str] = {}
        if title:
            result["title"] = title.strip()
        if description:
            result["description"] = description.strip()
        if normalized_image:
            result["image"] = normalized_image
        if normalized_url:
            result["url"] = normalized_url
        return result

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": "MercuryDesk/1.0 (+https://github.com/)"},
        ) as client:
            try:
                resp = client.get(self._feed_url)
                resp.raise_for_status()
            except Exception as e:
                raise ValueError(f"订阅源抓取失败: {e}") from e

            parsed = feedparser.parse(resp.content)
            feed_title = str(parsed.feed.get("title") or self._default_sender or "subscription")

            # 提取订阅源级别的图标/头像作为 sender_avatar_url
            feed_image_url: str | None = None
            feed_image = parsed.feed.get("image")
            if isinstance(feed_image, dict):
                feed_image_url = normalize_http_avatar_url(feed_image.get("href") or feed_image.get("url"))
            if not feed_image_url:
                feed_image_url = normalize_http_avatar_url(parsed.feed.get("logo"))
            if not feed_image_url:
                feed_image_url = normalize_http_avatar_url(parsed.feed.get("icon"))

            since_utc = since.astimezone(timezone.utc) if since else None
            messages: list[IncomingMessage] = []
            og_lookup_budget = min(self._max_entries, 12)

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
                summary = _strip_html(summary_raw)[:1800]

                preview_image = _extract_entry_image(entry, base_url=link or self._feed_url)
                if not preview_image:
                    preview_image = _extract_first_image_from_html(summary_raw, base_url=link or self._feed_url)

                og_meta: dict[str, str] = {}
                if link and og_lookup_budget > 0 and (not preview_image or not summary):
                    og_lookup_budget -= 1
                    og_meta = self._fetch_open_graph_metadata(client=client, page_url=link)

                preview_title = (og_meta.get("title") or title or "新内容更新").strip()[:300]
                preview_description = (og_meta.get("description") or summary).strip()[:1500]
                preview_link = (og_meta.get("url") or link).strip()
                preview_image = (preview_image or og_meta.get("image") or "").strip() or None

                if preview_link:
                    body = _build_preview_html(
                        title=preview_title,
                        description=preview_description,
                        link=preview_link,
                        preview_image=preview_image,
                    )
                else:
                    body = preview_description or preview_title

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
                        sender_avatar_url=feed_image_url,
                    )
                )

            return messages
