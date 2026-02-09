from __future__ import annotations

import re
from datetime import datetime, timezone
from html import escape

import httpx

from app.connectors.base import IncomingMessage
from app.connectors.feed import FeedConnector
from app.services.avatar import normalize_http_avatar_url

_USER_ID_RE = re.compile(r"user/profile/([a-f0-9]+)", re.IGNORECASE)
_NOTE_ID_RE = re.compile(r"explore/([a-f0-9]+)", re.IGNORECASE)
_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/16.6 Mobile/15E148 Safari/604.1"
)


def _extract_user_id(value: str) -> str:
    """从各种格式的输入中提取小红书用户 ID"""
    candidate = (value or "").strip()
    if not candidate:
        return ""

    if candidate.lower().startswith("xiaohongshu:"):
        candidate = candidate.split(":", 1)[1].strip()

    # 从 URL 中提取用户 ID
    user_match = _USER_ID_RE.search(candidate)
    if user_match:
        return user_match.group(1)

    # 如果看起来像是用户 ID 格式（十六进制）
    if re.match(r"^[a-f0-9]{20,30}$", candidate, re.IGNORECASE):
        return candidate

    return candidate


def _build_preview_html(*, title: str, description: str, link: str, cover_url: str | None) -> str:
    title_safe = escape((title or "").strip() or "小红书更新")
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
        + '" target="_blank" rel="noopener noreferrer">查看笔记</a></p>'
    )
    parts.append("</article>")
    return "".join(parts)


class XiaohongshuConnector:
    """小红书用户笔记订阅连接器"""

    def __init__(
        self,
        *,
        user_id: str,
        fallback_feed_url: str | None = None,
        default_sender: str | None = None,
        timeout_seconds: int = 60,
        max_items: int = 50,
        transport: httpx.BaseTransport | None = None,
    ):
        self._user_id = _extract_user_id(user_id)
        self._fallback_feed_url = (fallback_feed_url or "").strip() or None
        self._default_sender = (default_sender or "小红书用户").strip()
        self._timeout_seconds = max(10, timeout_seconds)
        self._max_items = max(1, max_items)
        self._transport = transport

    def _fetch_notes(self, *, since: datetime | None) -> list[IncomingMessage]:
        """通过 jina.ai 抓取用户笔记列表"""
        if not self._user_id:
            raise ValueError("小红书订阅缺少有效用户 ID")

        since_utc = since.astimezone(timezone.utc) if since else None

        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": _DEFAULT_USER_AGENT},
            transport=self._transport,
        ) as client:
            # 获取用户主页
            url = f"https://r.jina.ai/https://www.xiaohongshu.com/user/profile/{self._user_id}"
            response = client.get(
                url,
                headers={"Accept": "text/plain, text/markdown;q=0.9, */*;q=0.8"},
            )
            response.raise_for_status()
            body = response.text or ""

            # 尝试从页面提取头像 URL
            avatar_match = re.search(
                r"(https?://[^\s)\"']+(?:avatar|user)[^\s)\"']*\.(?:jpeg|jpg|png|webp)[^\s)\"']*)",
                body,
                re.IGNORECASE
            )
            avatar = normalize_http_avatar_url(avatar_match.group(1)) if avatar_match else None

            # 尝试提取用户名
            name_match = re.search(r"#\s*(.+?)\s*(?:的小红书|的主页|\n|$)", body)
            sender = name_match.group(1).strip() if name_match else self._default_sender

            # 提取笔记链接和标题
            # 小红书笔记 URL 格式: https://www.xiaohongshu.com/explore/xxxxx
            note_pattern = re.compile(
                r"\[([^\]]+)\]\(https://www\.xiaohongshu\.com/explore/([a-f0-9]+)[^\)]*\)",
                re.IGNORECASE
            )

            messages: list[IncomingMessage] = []
            seen_ids: set[str] = set()

            for match in note_pattern.finditer(body):
                title = match.group(1).strip()
                note_id = match.group(2)

                if note_id in seen_ids:
                    continue
                seen_ids.add(note_id)

                link = f"https://www.xiaohongshu.com/explore/{note_id}"

                # 尝试提取封面图
                cover_match = re.search(
                    rf"!\[[^\]]*\]\((https://[^\)]+)\).*?{note_id}",
                    body,
                    re.IGNORECASE | re.DOTALL
                )
                cover = normalize_http_avatar_url(cover_match.group(1)) if cover_match else None

                messages.append(
                    IncomingMessage(
                        source="xiaohongshu",
                        external_id=note_id,
                        sender=sender,
                        subject=title[:998] if title else f"{sender} 发布了新笔记",
                        body=_build_preview_html(
                            title=title or f"{sender} 发布了新笔记",
                            description=title,
                            link=link,
                            cover_url=cover,
                        ),
                        received_at=datetime.now(timezone.utc),
                        sender_avatar_url=avatar,
                    )
                )

                if len(messages) >= self._max_items:
                    break

            return messages

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        try:
            return self._fetch_notes(since=since)
        except Exception as primary_error:
            if self._fallback_feed_url:
                try:
                    return FeedConnector(
                        feed_url=self._fallback_feed_url,
                        source="xiaohongshu",
                        default_sender=self._default_sender,
                        timeout_seconds=self._timeout_seconds,
                        max_entries=self._max_items,
                    ).fetch_new_messages(since=since)
                except Exception as fallback_error:
                    raise ValueError(
                        f"小红书抓取失败: {primary_error}; 订阅源回退失败: {fallback_error}"
                    ) from fallback_error
            raise ValueError(f"小红书抓取失败: {primary_error}") from primary_error
