from __future__ import annotations

import re
from datetime import datetime, timezone
from html import escape
from typing import Any

import httpx

from app.connectors.base import IncomingMessage
from app.connectors.feed import FeedConnector
from app.services.avatar import normalize_http_avatar_url

_UID_RE = re.compile(r"\d{3,20}")
_SPACE_UID_RE = re.compile(r"space\.bilibili\.com/(\d{3,20})", flags=re.IGNORECASE)
_BVID_RE = re.compile(r"\b(BV[0-9A-Za-z]{10})\b")
_FACE_URL_RE = re.compile(r"(https?://[^\s)\]]*/bfs/face/[^\s)\]]+)", flags=re.IGNORECASE)
_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)


def _extract_uid(value: str) -> str:
    candidate = (value or "").strip()
    if not candidate:
        return ""

    if candidate.lower().startswith("bilibili:"):
        candidate = candidate.split(":", 1)[1].strip()

    space_match = _SPACE_UID_RE.search(candidate)
    if space_match:
        return space_match.group(1)

    first_digits = _UID_RE.search(candidate)
    return first_digits.group(0) if first_digits else ""


def _to_datetime(value: object) -> datetime:
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            pass
    return datetime.now(timezone.utc)


def _build_preview_html(*, title: str, description: str, link: str, cover_url: str | None) -> str:
    title_safe = escape((title or "").strip() or "B站更新")
    description_safe = escape((description or "").strip())
    link_safe = escape((link or "").strip(), quote=True)
    cover_safe = escape((cover_url or "").strip(), quote=True) if cover_url else ""

    parts = [
        '<article class="md-link-preview">',
        f'<meta property="og:title" content="{title_safe}" />',
        f'<meta property="og:description" content="{description_safe}" />',
        f'<meta property="og:url" content="{link_safe}" />',
    ]
    if cover_safe:
        parts.append(f'<meta property="og:image" content="{cover_safe}" />')
        parts.append(f'<img src="{cover_safe}" alt="{title_safe}" />')
    parts.append(f"<h3>{title_safe}</h3>")
    if description_safe:
        parts.append(f"<p>{description_safe}</p>")
    parts.append(
        '<p><a href="'
        + link_safe
        + '" target="_blank" rel="noopener noreferrer">查看视频</a></p>'
    )
    parts.append("</article>")
    return "".join(parts)


def _unique_bvids(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


class BilibiliConnector:
    def __init__(
        self,
        *,
        uid: str,
        fallback_feed_url: str | None = None,
        default_sender: str | None = None,
        timeout_seconds: int = 20,
        max_items: int = 80,
        transport: httpx.BaseTransport | None = None,
    ):
        self._uid = _extract_uid(uid)
        self._fallback_feed_url = (fallback_feed_url or "").strip() or None
        self._default_sender = (default_sender or f"B站 UP {self._uid or ''}").strip() or "Bilibili"
        self._timeout_seconds = max(5, timeout_seconds)
        self._max_items = max(1, max_items)
        self._transport = transport

    def _fetch_user_info(self, *, client: httpx.Client) -> tuple[str | None, str | None]:
        """通过 B 站 API 获取用户头像和昵称（尝试多个端点）"""
        if not self._uid:
            return None, None

        endpoints = [
            ("https://api.bilibili.com/x/web-interface/card", {"mid": self._uid, "photo": "true"}),
            ("https://api.bilibili.com/x/space/acc/info", {"mid": self._uid}),
        ]

        for url, params in endpoints:
            try:
                response = client.get(
                    url,
                    params=params,
                    headers={"Referer": f"https://space.bilibili.com/{self._uid}/"},
                )
                if response.status_code != 200:
                    continue

                payload = response.json()
                if not isinstance(payload, dict) or payload.get("code") != 0:
                    continue

                data = payload.get("data")
                if not isinstance(data, dict):
                    continue

                # Handle 'card' endpoint structure
                card = data.get("card")
                if isinstance(card, dict):
                    avatar = normalize_http_avatar_url(card.get("face"))
                    name = str(card.get("name") or "").strip() or None
                    if avatar:
                        return avatar, name

                # Handle 'acc/info' endpoint structure
                face = data.get("face")
                if face:
                    avatar = normalize_http_avatar_url(face)
                    name = str(data.get("name") or "").strip() or None
                    return avatar, name

            except Exception:
                continue

        return None, None

    def _discover_bvids(self, *, client: httpx.Client) -> tuple[list[str], str | None]:
        if not self._uid:
            raise ValueError("Bilibili 订阅缺少有效 UID")

        candidate_urls = [
            f"https://r.jina.ai/http://space.bilibili.com/{self._uid}/video",
            f"https://r.jina.ai/http://space.bilibili.com/{self._uid}/dynamic",
        ]

        for url in candidate_urls:
            try:
                response = client.get(
                    url,
                    headers={"Accept": "text/plain, text/markdown;q=0.9, */*;q=0.8"},
                )
                response.raise_for_status()
            except Exception:
                continue
            body = response.text or ""
            bvids = _unique_bvids(_BVID_RE.findall(body))
            face_match = _FACE_URL_RE.search(body)
            fallback_avatar = (
                normalize_http_avatar_url(face_match.group(1))
                if face_match
                else None
            )
            if bvids:
                return bvids, fallback_avatar

        raise ValueError("未能从 B 站页面解析到视频列表")

    def _fetch_video_detail(self, *, client: httpx.Client, bvid: str) -> dict[str, Any] | None:
        try:
            response = client.get(
                "https://api.bilibili.com/x/web-interface/view",
                params={"bvid": bvid},
                headers={"Referer": f"https://www.bilibili.com/video/{bvid}/"},
            )
            response.raise_for_status()
        except Exception:
            return None

        try:
            payload = response.json()
        except ValueError:
            return None
        if not isinstance(payload, dict) or payload.get("code") != 0:
            return None
        data = payload.get("data")
        return data if isinstance(data, dict) else None

    def _fetch_videos(self, *, since: datetime | None) -> list[IncomingMessage]:
        since_utc = since.astimezone(timezone.utc) if since else None
        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": _DEFAULT_USER_AGENT},
            transport=self._transport,
        ) as client:
            # 优先通过 API 获取可靠头像和昵称
            api_avatar, api_name = self._fetch_user_info(client=client)
            bvids, fallback_avatar = self._discover_bvids(client=client)
            # API 头像优先于 jina.ai 页面解析的头像
            primary_avatar = api_avatar or fallback_avatar
            primary_name = api_name
            messages: list[IncomingMessage] = []
            for bvid in bvids:
                detail = self._fetch_video_detail(client=client, bvid=bvid)
                if not detail:
                    continue

                # 如果主头像获取失败，尝试从第一个视频详情中提取 UP 主头像作为补充
                owner = detail.get("owner") if isinstance(detail.get("owner"), dict) else {}
                owner_face = normalize_http_avatar_url(owner.get("face"))
                if not primary_avatar and owner_face:
                    primary_avatar = owner_face

                received_at = _to_datetime(detail.get("pubdate"))
                if since_utc is not None and received_at <= since_utc:
                    continue

                title = str(detail.get("title") or f"B站更新 {bvid}").strip()
                description = str(detail.get("desc") or "").strip()
                if not description:
                    description = f"UP 主发布了新视频：{title}"
                link = f"https://www.bilibili.com/video/{bvid}/"
                cover = normalize_http_avatar_url(detail.get("pic"))
                sender = str(owner.get("name") or primary_name or self._default_sender).strip() or self._default_sender
                sender_avatar_url = owner_face or primary_avatar

                messages.append(
                    IncomingMessage(
                        source="bilibili",
                        external_id=bvid,
                        sender=sender,
                        subject=title[:998],
                        body=_build_preview_html(
                            title=title,
                            description=description[:1500],
                            link=link,
                            cover_url=cover,
                        ),
                        received_at=received_at,
                        sender_avatar_url=sender_avatar_url,
                    )
                )
                if len(messages) >= self._max_items:
                    break
            return messages

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        try:
            return self._fetch_videos(since=since)
        except Exception as primary_error:
            if self._fallback_feed_url:
                try:
                    return FeedConnector(
                        feed_url=self._fallback_feed_url,
                        source="bilibili",
                        default_sender=self._default_sender,
                        timeout_seconds=self._timeout_seconds,
                        max_entries=self._max_items,
                    ).fetch_new_messages(since=since)
                except Exception as fallback_error:
                    raise ValueError(
                        f"Bilibili 抓取失败: {primary_error}; 订阅源回退失败: {fallback_error}"
                    ) from fallback_error
            raise ValueError(f"Bilibili 抓取失败: {primary_error}") from primary_error
