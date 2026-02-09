from __future__ import annotations

import re
from datetime import datetime, timezone
from html import escape

import httpx

from app.connectors.base import IncomingMessage
from app.connectors.feed import FeedConnector
from app.services.avatar import normalize_http_avatar_url

_UID_RE = re.compile(r"\d{5,15}")
_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/16.6 Mobile/15E148 Safari/604.1"
)


def _extract_uid(value: str) -> str:
    """从各种格式的输入中提取微博用户 UID"""
    candidate = (value or "").strip()
    if not candidate:
        return ""

    if candidate.lower().startswith("weibo:"):
        candidate = candidate.split(":", 1)[1].strip()

    # 从 URL 中提取 UID
    # 格式: weibo.com/u/1234567890 或 weibo.com/1234567890
    uid_match = re.search(r"weibo\.com/(?:u/)?(\d{5,15})", candidate, re.IGNORECASE)
    if uid_match:
        return uid_match.group(1)

    # 纯数字 UID
    if re.match(r"^\d{5,15}$", candidate):
        return candidate

    return candidate


def _to_datetime(value: object) -> datetime:
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            pass
    if isinstance(value, str):
        # 尝试解析微博时间格式
        try:
            return datetime.strptime(value, "%a %b %d %H:%M:%S %z %Y")
        except Exception:
            pass
    return datetime.now(timezone.utc)


def _build_preview_html(*, title: str, description: str, link: str, cover_url: str | None) -> str:
    title_safe = escape((title or "").strip() or "微博更新")
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
        + '" target="_blank" rel="noopener noreferrer">查看微博</a></p>'
    )
    parts.append("</article>")
    return "".join(parts)


class WeiboConnector:
    """微博用户动态订阅连接器"""

    def __init__(
        self,
        *,
        uid: str,
        fallback_feed_url: str | None = None,
        default_sender: str | None = None,
        timeout_seconds: int = 30,
        max_items: int = 50,
        transport: httpx.BaseTransport | None = None,
    ):
        self._uid = _extract_uid(uid)
        self._fallback_feed_url = (fallback_feed_url or "").strip() or None
        self._default_sender = (default_sender or "微博用户").strip()
        self._timeout_seconds = max(5, timeout_seconds)
        self._max_items = max(1, max_items)
        self._transport = transport

    def _fetch_user_info(self, *, client: httpx.Client) -> tuple[str | None, str | None]:
        """通过微博 API 获取用户头像和昵称"""
        if not self._uid:
            return None, None

        try:
            # 使用微博移动端 API
            url = f"https://m.weibo.cn/api/container/getIndex?type=uid&value={self._uid}"
            response = client.get(url)
            if response.status_code != 200:
                return None, None

            payload = response.json()
            if not isinstance(payload, dict) or payload.get("ok") != 1:
                return None, None

            data = payload.get("data", {})
            user_info = data.get("userInfo", {})

            avatar = normalize_http_avatar_url(user_info.get("avatar_hd") or user_info.get("profile_image_url"))
            name = str(user_info.get("screen_name") or "").strip() or None

            return avatar, name
        except Exception:
            return None, None

    def _fetch_posts(self, *, since: datetime | None) -> list[IncomingMessage]:
        """通过微博移动端 API 抓取用户微博列表"""
        if not self._uid:
            raise ValueError("微博订阅缺少有效 UID")

        since_utc = since.astimezone(timezone.utc) if since else None

        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": _DEFAULT_USER_AGENT},
            transport=self._transport,
        ) as client:
            # 获取用户信息
            avatar, name = self._fetch_user_info(client=client)
            sender = name or self._default_sender

            # 获取用户微博列表
            # 首先获取 containerid
            index_url = f"https://m.weibo.cn/api/container/getIndex?type=uid&value={self._uid}"
            response = client.get(index_url)
            response.raise_for_status()

            payload = response.json()
            if not isinstance(payload, dict) or payload.get("ok") != 1:
                raise ValueError("无法获取微博用户信息")

            # 查找微博容器 ID
            tabs = payload.get("data", {}).get("tabsInfo", {}).get("tabs", [])
            containerid = None
            for tab in tabs:
                if tab.get("tab_type") == "weibo":
                    containerid = tab.get("containerid")
                    break

            if not containerid:
                # 尝试构造默认的 containerid
                containerid = f"107603{self._uid}"

            # 获取微博列表
            weibo_url = f"https://m.weibo.cn/api/container/getIndex?type=uid&value={self._uid}&containerid={containerid}"
            response = client.get(weibo_url)
            response.raise_for_status()

            payload = response.json()
            if not isinstance(payload, dict) or payload.get("ok") != 1:
                raise ValueError("无法获取微博列表")

            cards = payload.get("data", {}).get("cards", [])
            messages: list[IncomingMessage] = []

            for card in cards:
                if card.get("card_type") != 9:  # 9 是微博类型
                    continue

                mblog = card.get("mblog", {})
                if not mblog:
                    continue

                weibo_id = str(mblog.get("id") or mblog.get("mid") or "")
                if not weibo_id:
                    continue

                # 解析时间
                created_at_str = mblog.get("created_at", "")
                received_at = _to_datetime(created_at_str)

                if since_utc is not None and received_at <= since_utc:
                    continue

                # 提取内容
                text = mblog.get("text", "")
                # 移除 HTML 标签
                text_clean = re.sub(r"<[^>]+>", "", text).strip()
                title = text_clean[:100] if text_clean else f"{sender} 发布了新微博"

                # 提取图片
                pics = mblog.get("pics", [])
                cover = None
                if pics and isinstance(pics, list) and pics:
                    first_pic = pics[0]
                    cover = normalize_http_avatar_url(
                        first_pic.get("large", {}).get("url") or first_pic.get("url")
                    )

                # 用户头像（优先使用微博中的用户信息）
                user = mblog.get("user", {})
                post_avatar = normalize_http_avatar_url(
                    user.get("avatar_hd") or user.get("profile_image_url")
                ) or avatar
                post_sender = str(user.get("screen_name") or "").strip() or sender

                link = f"https://m.weibo.cn/detail/{weibo_id}"

                messages.append(
                    IncomingMessage(
                        source="weibo",
                        external_id=weibo_id,
                        sender=post_sender,
                        subject=title[:998],
                        body=_build_preview_html(
                            title=title,
                            description=text_clean[:1500],
                            link=link,
                            cover_url=cover,
                        ),
                        received_at=received_at,
                        sender_avatar_url=post_avatar,
                    )
                )

                if len(messages) >= self._max_items:
                    break

            return messages

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        try:
            return self._fetch_posts(since=since)
        except Exception as primary_error:
            if self._fallback_feed_url:
                try:
                    return FeedConnector(
                        feed_url=self._fallback_feed_url,
                        source="weibo",
                        default_sender=self._default_sender,
                        timeout_seconds=self._timeout_seconds,
                        max_entries=self._max_items,
                    ).fetch_new_messages(since=since)
                except Exception as fallback_error:
                    raise ValueError(
                        f"微博抓取失败: {primary_error}; 订阅源回退失败: {fallback_error}"
                    ) from fallback_error
            raise ValueError(f"微博抓取失败: {primary_error}") from primary_error
