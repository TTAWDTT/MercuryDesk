from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from html import escape, unescape
from typing import Any, Iterator

import httpx

from app.connectors.base import IncomingMessage
from app.connectors.feed import FeedConnector
from app.services.avatar import normalize_http_avatar_url
from app.settings import settings


class _RateLimitError(Exception):
    """429 限流专用异常，上层策略链据此决定是否跳过低质量回退。"""
    pass

# ============================================================
# X API v2 官方接口配置
# ============================================================
# 环境变量: X_BEARER_TOKEN - 官方 API Bearer Token (可选)
# 如果配置了此 Token，将优先使用官方 API，更稳定可靠
# ============================================================

_X_API_BASE_URL = "https://api.x.com/2"
_X_API_RATE_LIMIT_WINDOW = 900  # 15 分钟窗口

_NITTER_INSTANCES = [
    "https://nitter.uni-sonia.com",
    "https://nitter.moomoo.me",
    "https://nitter.soopy.moe",
    "https://nitter.privacydev.net",
    "https://nitter.poast.org",
    "https://nitter.lucabased.xyz",
    "https://nitter.net",
]

_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)
_MAIN_JS_RE = re.compile(r"https://abs\.twimg\.com/responsive-web/client-web/main\.[^\"'<>]+\.js")
_GUEST_TOKEN_RE = re.compile(r'document\.cookie="gt=(\d+);')
_BEARER_TOKEN_RE = re.compile(r"AAAAA[0-9A-Za-z%]{60,}")
_TWITTER_DATETIME_FORMAT = "%a %b %d %H:%M:%S %z %Y"


def _normalize_username(value: str) -> str:
    candidate = (value or "").strip()
    if not candidate:
        return ""
    if candidate.lower().startswith("x:"):
        candidate = candidate[2:]
    if "://" in candidate or "x.com/" in candidate.lower() or "twitter.com/" in candidate.lower():
        parsed = urllib.parse.urlparse(candidate if "://" in candidate else f"https://{candidate}")
        host = (parsed.netloc or "").lower().strip()
        parts = [part for part in (parsed.path or "").split("/") if part]
        if host.endswith("x.com") or host.endswith("twitter.com"):
            candidate = parts[0] if parts else candidate
        elif len(parts) >= 3 and parts[0] in {"x", "twitter"} and parts[1] == "user":
            candidate = parts[2]
        elif len(parts) >= 2 and parts[-1].lower() == "rss":
            candidate = parts[-2]
        elif parts:
            candidate = parts[0]
    candidate = candidate.lstrip("@").strip()
    if not candidate:
        return ""
    matched = re.search(r"[A-Za-z0-9_]{1,15}", candidate)
    return matched.group(0) if matched else candidate


def _parse_string_array(value: str) -> list[str]:
    return [matched.strip() for matched in re.findall(r'"([^"]+)"', value or "") if matched.strip()]


def _extract_operation_spec(bundle: str, operation_name: str) -> tuple[str, list[str], list[str]]:
    pattern = re.compile(
        rf'queryId:"(?P<query_id>[A-Za-z0-9_-]{{20,}})",operationName:"{re.escape(operation_name)}".*?metadata:\{{(?P<meta>[^}}]*)\}}',
        re.S,
    )
    matched = pattern.search(bundle)
    if not matched:
        raise ValueError(f"未能从 X 前端脚本解析 {operation_name} queryId")

    meta = matched.group("meta")
    feature_match = re.search(r"featureSwitches:\[(?P<items>[^\]]*)\]", meta, re.S)
    field_match = re.search(r"fieldToggles:\[(?P<items>[^\]]*)\]", meta, re.S)
    features = _parse_string_array(feature_match.group("items")) if feature_match else []
    field_toggles = _parse_string_array(field_match.group("items")) if field_match else []
    return matched.group("query_id"), features, field_toggles


def _parse_x_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, _TWITTER_DATETIME_FORMAT).astimezone(timezone.utc)
    except ValueError:
        return None


def _snowflake_datetime_from_id(value: str) -> datetime | None:
    text = (value or "").strip()
    if not text.isdigit():
        return None
    try:
        timestamp_ms = (int(text) >> 22) + 1288834974657
        return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    except Exception:
        return None


def _normalize_text(value: str) -> str:
    normalized = re.sub(r"\s+", " ", unescape(value or "")).strip()
    return normalized


def _unwrap_tweet_result(value: object) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    typename = str(value.get("__typename") or "").strip()
    if typename == "TweetWithVisibilityResults":
        nested = value.get("tweet")
        if isinstance(nested, dict):
            return nested
        return None
    if typename and typename not in {"Tweet", "TweetTombstone"}:
        return None
    return value


def _iter_item_contents(entry: dict[str, Any]) -> list[dict[str, Any]]:
    content = entry.get("content")
    if not isinstance(content, dict):
        return []
    result: list[dict[str, Any]] = []
    item_content = content.get("itemContent")
    if isinstance(item_content, dict):
        result.append(item_content)
    for module_item in content.get("items") or []:
        if not isinstance(module_item, dict):
            continue
        item = module_item.get("item")
        if not isinstance(item, dict):
            continue
        module_content = item.get("itemContent")
        if isinstance(module_content, dict):
            result.append(module_content)
    return result


def _extract_timeline_entries(instructions: object) -> list[dict[str, Any]]:
    if not isinstance(instructions, list):
        return []
    entries: list[dict[str, Any]] = []
    for instruction in instructions:
        if not isinstance(instruction, dict):
            continue
        single_entry = instruction.get("entry")
        if isinstance(single_entry, dict):
            entries.append(single_entry)
        listed_entries = instruction.get("entries")
        if isinstance(listed_entries, list):
            entries.extend([entry for entry in listed_entries if isinstance(entry, dict)])
    return entries


def _extract_bottom_cursor(entries: list[dict[str, Any]]) -> str | None:
    for entry in entries:
        entry_id = str(entry.get("entryId") or "").strip().lower()
        if not entry_id.startswith("cursor-bottom"):
            continue
        content = entry.get("content")
        if not isinstance(content, dict):
            continue
        value = str(content.get("value") or "").strip()
        if value:
            return value
    return None


def _extract_first_image_url(legacy: dict[str, Any]) -> str | None:
    media_lists: list[object] = []
    extended_entities = legacy.get("extended_entities")
    if isinstance(extended_entities, dict):
        media_lists.append(extended_entities.get("media"))
    entities = legacy.get("entities")
    if isinstance(entities, dict):
        media_lists.append(entities.get("media"))

    for media_list in media_lists:
        if not isinstance(media_list, list):
            continue
        for media in media_list:
            if not isinstance(media, dict):
                continue
            url = (
                str(media.get("media_url_https") or "").strip()
                or str(media.get("media_url") or "").strip()
            )
            if url.startswith("http://") or url.startswith("https://"):
                return url
    return None


def _expand_urls(text: str, entities: object) -> str:
    normalized = text or ""
    if not isinstance(entities, dict):
        return _normalize_text(normalized)

    for item in entities.get("urls") or []:
        if not isinstance(item, dict):
            continue
        short_url = str(item.get("url") or "").strip()
        expanded_url = str(item.get("expanded_url") or item.get("display_url") or "").strip()
        if short_url and expanded_url:
            normalized = normalized.replace(short_url, expanded_url)

    for item in entities.get("media") or []:
        if not isinstance(item, dict):
            continue
        short_url = str(item.get("url") or "").strip()
        if short_url:
            normalized = normalized.replace(short_url, "")

    return _normalize_text(normalized)


def _build_preview_body(*, title: str, description: str, link: str, preview_image: str | None) -> str:
    title_safe = escape((title or "").strip() or "X 更新")
    description_safe = escape((description or "").strip())
    link_safe = escape((link or "").strip(), quote=True)
    image_safe = escape((preview_image or "").strip(), quote=True) if preview_image else ""

    parts = [
        '<article class="md-link-preview">',
        f'<meta property="og:title" content="{title_safe}" />',
        f'<meta property="og:description" content="{description_safe}" />',
        f'<meta property="og:url" content="{link_safe}" />',
    ]
    if image_safe:
        parts.append(f'<meta property="og:image" content="{image_safe}" />')
        parts.append(f'<img src="{image_safe}" alt="{title_safe}" />')
    parts.append(f"<h3>{title_safe}</h3>")
    if description_safe:
        parts.append(f"<p>{description_safe}</p>")
    parts.append(
        '<p><a href="'
        + link_safe
        + '" target="_blank" rel="noopener noreferrer">查看原帖</a></p>'
    )
    parts.append("</article>")
    return "".join(parts)


def _extract_user_avatar_url(user: dict[str, Any], user_legacy: dict[str, Any]) -> str | None:
    avatar_obj = user.get("avatar")
    if isinstance(avatar_obj, dict):
        normalized = normalize_http_avatar_url(avatar_obj.get("image_url"))
        if normalized:
            return normalized
    for key in ("profile_image_url_https", "profile_image_url"):
        normalized = normalize_http_avatar_url(user_legacy.get(key))
        if normalized:
            return normalized
    return None


class XConnector:
    def __init__(
        self,
        *,
        username: str,
        fallback_feed_url: str | None = None,
        default_sender: str | None = None,
        timeout_seconds: int = 20,
        max_items: int = 80,
        transport: httpx.BaseTransport | None = None,
        bearer_token: str | None = None,
        auth_cookies: dict[str, str] | None = None,
    ):
        self._username = _normalize_username(username)
        self._fallback_feed_url = (fallback_feed_url or "").strip() or None
        self._default_sender = (default_sender or self._username or "x").strip()
        self._timeout_seconds = max(5, timeout_seconds)
        self._max_items = max(1, max_items)
        self._transport = transport
        # 官方 API Bearer Token (从参数传入，由 sync.py 从数据库读取)
        self._bearer_token = (bearer_token or "").strip() or None
        # X 浏览器 Cookie 认证 (auth_token + ct0)
        self._auth_cookies = auth_cookies if auth_cookies and auth_cookies.get("auth_token") and auth_cookies.get("ct0") else None

    # ============================================================
    # X API v2 官方接口实现
    # ============================================================

    def _get_api_headers(self) -> dict[str, str]:
        """构建官方 API 请求头"""
        if not self._bearer_token:
            raise ValueError("X API 需要配置 X_BEARER_TOKEN 环境变量")
        return {
            "Authorization": f"Bearer {self._bearer_token}",
            "User-Agent": _DEFAULT_USER_AGENT,
            "Accept": "application/json",
        }

    def _get_user_by_username(self, client: httpx.Client) -> dict[str, Any]:
        """
        GET /2/users/by/username/{username}
        获取用户信息，包括 user_id、头像等
        """
        url = f"{_X_API_BASE_URL}/users/by/username/{self._username}"
        params = {
            "user.fields": "id,name,username,profile_image_url,created_at,description,public_metrics",
        }
        response = client.get(url, headers=self._get_api_headers(), params=params)

        # 处理限流
        if response.status_code == 429:
            reset_time = response.headers.get("x-rate-limit-reset")
            wait_seconds = 60
            if reset_time and reset_time.isdigit():
                wait_seconds = max(1, int(reset_time) - int(time.time()))
            raise ValueError(f"X API 限流，需等待 {min(wait_seconds, 300)} 秒")

        response.raise_for_status()
        payload = response.json()

        if "data" not in payload:
            errors = payload.get("errors", [])
            if errors:
                raise ValueError(f"X API 用户查询失败: {errors[0].get('detail', 'unknown')}")
            raise ValueError("X API 用户查询响应缺少数据")

        return payload["data"]

    def _iter_user_posts(
        self,
        client: httpx.Client,
        user_id: str,
        *,
        since_id: str | None = None,
        max_results: int = 100,
        pages: int = 5,
    ) -> Iterator[dict[str, Any]]:
        """
        GET /2/users/{id}/tweets
        迭代获取用户发帖列表
        - max_results: 5..100
        - 支持 since_id 增量更新
        - 支持 pagination_token 翻页
        - exclude=replies,retweets 过滤回复和转发
        """
        max_results = max(5, min(100, max_results))
        url = f"{_X_API_BASE_URL}/users/{user_id}/tweets"

        params: dict[str, Any] = {
            "max_results": max_results,
            "exclude": "replies,retweets",
            "tweet.fields": "id,text,created_at,public_metrics,attachments,entities",
            "expansions": "attachments.media_keys,author_id",
            "media.fields": "url,preview_image_url,type",
        }

        if since_id:
            params["since_id"] = since_id

        pagination_token: str | None = None

        for _ in range(pages):
            if pagination_token:
                params["pagination_token"] = pagination_token

            response = client.get(url, headers=self._get_api_headers(), params=params)

            # 处理限流 - 等待后重试一次
            if response.status_code == 429:
                reset_time = response.headers.get("x-rate-limit-reset")
                wait_seconds = 60
                if reset_time and reset_time.isdigit():
                    wait_seconds = max(1, int(reset_time) - int(time.time()))
                time.sleep(min(wait_seconds, 120))
                response = client.get(url, headers=self._get_api_headers(), params=params)

            response.raise_for_status()
            payload = response.json()

            # 提取媒体映射 (用于获取图片)
            media_map: dict[str, str] = {}
            includes = payload.get("includes", {})
            for media in includes.get("media", []):
                media_key = media.get("media_key")
                media_url = media.get("url") or media.get("preview_image_url")
                if media_key and media_url:
                    media_map[media_key] = media_url

            for post in payload.get("data", []) or []:
                # 附加媒体 URL 到 post 对象
                post["_media_map"] = media_map
                yield post

            meta = payload.get("meta", {})
            pagination_token = meta.get("next_token")
            if not pagination_token:
                break

    def _fetch_via_official_api(self, *, since: datetime | None) -> list[IncomingMessage]:
        """
        使用官方 X API v2 获取用户推文
        优先级最高，需要配置 X_BEARER_TOKEN 环境变量
        """
        if not self._bearer_token:
            raise ValueError("未配置 X_BEARER_TOKEN，跳过官方 API")

        if not self._username:
            raise ValueError("X 订阅需要有效用户名")

        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            transport=self._transport,
        ) as client:
            # 1. 获取用户信息
            user_info = self._get_user_by_username(client)
            user_id = user_info.get("id")
            if not user_id:
                raise ValueError("X API 无法获取用户 ID")

            display_name = user_info.get("name") or f"@{self._username}"
            avatar_url = normalize_http_avatar_url(user_info.get("profile_image_url"))

            # 2. 获取用户推文
            since_utc = since.astimezone(timezone.utc) if since else None
            messages: list[IncomingMessage] = []

            for post in self._iter_user_posts(
                client,
                user_id,
                max_results=min(self._max_items, 100),
                pages=max(1, (self._max_items + 99) // 100),
            ):
                post_id = post.get("id", "")
                text = post.get("text", "").strip()
                created_at_str = post.get("created_at", "")

                # 解析时间 (ISO8601 格式)
                created_at: datetime
                if created_at_str:
                    try:
                        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    except ValueError:
                        created_at = datetime.now(timezone.utc)
                else:
                    created_at = _snowflake_datetime_from_id(post_id) or datetime.now(timezone.utc)

                # 过滤旧消息
                if since_utc and created_at <= since_utc:
                    continue

                # 提取首张图片
                preview_image: str | None = None
                media_map = post.get("_media_map", {})
                attachments = post.get("attachments", {})
                for media_key in attachments.get("media_keys", []):
                    if media_key in media_map:
                        preview_image = media_map[media_key]
                        break

                link = f"https://x.com/{self._username}/status/{post_id}"
                subject = text[:120] if text else f"{display_name} 发布了新帖"
                body = _build_preview_body(
                    title=f"{display_name} 发布了新帖",
                    description=text[:1600],
                    link=link,
                    preview_image=preview_image,
                )

                messages.append(
                    IncomingMessage(
                        source="x",
                        external_id=post_id,
                        sender=f"@{self._username}",
                        subject=subject,
                        body=body,
                        received_at=created_at,
                        sender_avatar_url=avatar_url,
                    )
                )

            messages.sort(key=lambda m: (m.received_at, m.external_id or ""), reverse=True)
            return messages[: self._max_items]

    def _call_graphql(
        self,
        *,
        client: httpx.Client,
        operation_name: str,
        query_id: str,
        variables: dict[str, Any],
        feature_switches: list[str],
        field_toggles: list[str],
        headers: dict[str, str],
    ) -> dict[str, Any]:
        params = {
            "variables": json.dumps(variables, separators=(",", ":"), ensure_ascii=False),
            "features": json.dumps({name: False for name in feature_switches}, separators=(",", ":")),
        }
        if field_toggles:
            params["fieldToggles"] = json.dumps({name: False for name in field_toggles}, separators=(",", ":"))

        url = f"https://x.com/i/api/graphql/{query_id}/{operation_name}"
        response = client.get(url, headers=headers, params=params)
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if response.status_code >= 400:
            detail = ""
            if isinstance(payload, dict):
                errors = payload.get("errors")
                if isinstance(errors, list) and errors:
                    first = errors[0]
                    if isinstance(first, dict):
                        detail = str(first.get("message") or "").strip()
            detail = detail or f"HTTP {response.status_code}"
            # 429 限流使用专门的异常类，方便上层区分处理
            if response.status_code == 429:
                raise _RateLimitError(f"X {operation_name} 被限流: {detail}")
            raise ValueError(f"X {operation_name} 请求失败: {detail}")
        if isinstance(payload, dict):
            errors = payload.get("errors")
            if isinstance(errors, list) and errors:
                has_data = payload.get("data") is not None
                if not has_data:
                    first = errors[0]
                    detail = str(first.get("message") or "").strip() if isinstance(first, dict) else ""
                    raise ValueError(f"X {operation_name} 响应异常: {detail or 'unknown error'}")
        return payload if isinstance(payload, dict) else {}

    # ============================================================
    # 基于 Cookie 认证的 GraphQL 请求（返回时间线而非热门推文）
    # ============================================================

    def _fetch_via_graphql_auth(self, *, since: datetime | None) -> list[IncomingMessage]:
        """
        使用用户浏览器 Cookie (auth_token + ct0) 进行认证 GraphQL 请求。
        认证后 UserTweets 返回真实时间线（按时间排序），而非访客看到的热门推文。
        """
        if not self._auth_cookies:
            raise ValueError("未配置 X 认证 Cookie")
        if not self._username:
            raise ValueError("X 订阅需要有效用户名")

        auth_token = self._auth_cookies["auth_token"]
        ct0 = self._auth_cookies["ct0"]

        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": _DEFAULT_USER_AGENT},
            cookies={"auth_token": auth_token, "ct0": ct0},
            transport=self._transport,
        ) as client:
            # 1. 获取 main.js 和 bearer token（同访客流程）
            profile_url = f"https://x.com/{self._username}"
            profile_response = client.get(profile_url)
            profile_response.raise_for_status()
            profile_html = profile_response.text or ""

            main_js_match = _MAIN_JS_RE.search(profile_html)
            if not main_js_match:
                raise ValueError("未能解析 X 前端脚本地址（Cookie 可能已过期）")
            main_js_url = main_js_match.group(0)

            main_js_response = client.get(main_js_url)
            main_js_response.raise_for_status()
            main_js = main_js_response.text or ""

            bearer_match = _BEARER_TOKEN_RE.search(main_js)
            if not bearer_match:
                raise ValueError("未能解析 X bearer token")
            bearer_token = urllib.parse.unquote(bearer_match.group(0))

            user_query_id, user_features, user_toggles = _extract_operation_spec(main_js, "UserByScreenName")
            tweets_query_id, tweets_features, tweets_toggles = _extract_operation_spec(main_js, "UserTweets")

            # 2. 认证请求头：使用 ct0 作为 CSRF token，不使用 guest token
            api_headers = {
                "Authorization": f"Bearer {bearer_token}",
                "x-csrf-token": ct0,
                "x-twitter-auth-type": "OAuth2Session",
                "x-twitter-active-user": "yes",
                "x-twitter-client-language": "en",
                "Referer": profile_url,
                "User-Agent": _DEFAULT_USER_AGENT,
                "Accept": "*/*",
            }

            # 3. 获取用户信息
            user_payload = self._call_graphql(
                client=client,
                operation_name="UserByScreenName",
                query_id=user_query_id,
                variables={
                    "screen_name": self._username,
                    "withSafetyModeUserFields": True,
                },
                feature_switches=user_features,
                field_toggles=user_toggles,
                headers=api_headers,
            )
            user_result = (
                user_payload.get("data", {})
                .get("user", {})
                .get("result", {})
            )
            if not isinstance(user_result, dict):
                raise ValueError("Cookie 认证 UserByScreenName 响应缺少用户信息（Cookie 可能已过期）")
            rest_id = str(user_result.get("rest_id") or "").strip()
            if not rest_id:
                raise ValueError("Cookie 认证 UserByScreenName 响应缺少 rest_id")

            # 复用 _fetch_via_graphql 的结果解析逻辑
            user_legacy = user_result.get("legacy") or {}
            if not isinstance(user_legacy, dict):
                user_legacy = {}
            canonical_screen_name = str(user_legacy.get("screen_name") or self._username).strip() or self._username
            canonical_name = str(user_legacy.get("name") or f"@{canonical_screen_name}").strip() or f"@{canonical_screen_name}"
            canonical_avatar_url = _extract_user_avatar_url(user_result, user_legacy)

            # 4. 获取用户推文（认证后返回时间线而非热门）
            timeline_count = min(max(self._max_items, 20), 100)
            max_pages = 2
            entries: list[dict[str, Any]] = []
            cursor: str | None = None
            seen_cursors: set[str] = set()

            for page_idx in range(max_pages):
                if page_idx > 0:
                    time.sleep(2)  # 翻页间延迟，避免触发 429
                variables: dict[str, Any] = {
                    "userId": rest_id,
                    "count": timeline_count,
                    "includePromotedContent": False,
                    "withQuickPromoteEligibilityTweetFields": True,
                    "withVoice": True,
                    "withV2Timeline": True,
                }
                if cursor:
                    variables["cursor"] = cursor

                try:
                    tweets_payload = self._call_graphql(
                        client=client,
                        operation_name="UserTweets",
                        query_id=tweets_query_id,
                        variables=variables,
                        feature_switches=tweets_features,
                        field_toggles=tweets_toggles,
                        headers=api_headers,
                    )
                except _RateLimitError:
                    # 翻页中被限流：已有数据就返回已有的，否则向上抛出
                    if entries:
                        break
                    raise

                timeline = (
                    tweets_payload.get("data", {})
                    .get("user", {})
                    .get("result", {})
                    .get("timeline", {})
                    .get("timeline", {})
                )
                instructions = timeline.get("instructions") if isinstance(timeline, dict) else None
                page_entries = _extract_timeline_entries(instructions)
                if not page_entries:
                    break
                entries.extend(page_entries)

                # 已收集足够数据则提前结束
                if len(entries) >= self._max_items:
                    break

                next_cursor = _extract_bottom_cursor(page_entries)
                if not next_cursor or next_cursor in seen_cursors:
                    break
                seen_cursors.add(next_cursor)
                cursor = next_cursor

        # 5. 解析推文（复用与 _fetch_via_graphql 完全相同的逻辑）
        return self._parse_graphql_entries(
            entries=entries,
            since=since,
            canonical_screen_name=canonical_screen_name,
            canonical_name=canonical_name,
            canonical_avatar_url=canonical_avatar_url,
        )

    # ============================================================
    # GraphQL 结果解析（公共方法，供 guest 和 auth 两种方式共用）
    # ============================================================

    def _parse_graphql_entries(
        self,
        *,
        entries: list[dict[str, Any]],
        since: datetime | None,
        canonical_screen_name: str,
        canonical_name: str,
        canonical_avatar_url: str | None,
    ) -> list[IncomingMessage]:
        since_utc = since.astimezone(timezone.utc) if since is not None else None
        if since_utc is not None:
            since_utc = since_utc - timedelta(hours=24)
        messages: list[IncomingMessage] = []
        seen_ids: set[str] = set()
        for entry in entries:
            for item_content in _iter_item_contents(entry):
                tweet_result = (item_content.get("tweet_results") or {}).get("result")
                tweet = _unwrap_tweet_result(tweet_result)
                if not isinstance(tweet, dict):
                    continue
                tweet_legacy = tweet.get("legacy")
                if not isinstance(tweet_legacy, dict):
                    continue

                tweet_id = str(tweet.get("rest_id") or tweet_legacy.get("id_str") or "").strip()
                if not tweet_id or tweet_id in seen_ids:
                    continue
                created_at = (
                    _parse_x_datetime(tweet_legacy.get("created_at"))
                    or _snowflake_datetime_from_id(tweet_id)
                    or datetime.now(timezone.utc)
                )
                if since_utc is not None and created_at <= since_utc:
                    continue

                tweet_user = (
                    (tweet.get("core") or {})
                    .get("user_results", {})
                    .get("result", {})
                )
                if not isinstance(tweet_user, dict):
                    tweet_user = {}
                tweet_user_legacy = tweet_user.get("legacy")
                if not isinstance(tweet_user_legacy, dict):
                    tweet_user_legacy = {}
                sender_avatar_url = _extract_user_avatar_url(tweet_user, tweet_user_legacy) or canonical_avatar_url

                screen_name = str(tweet_user_legacy.get("screen_name") or canonical_screen_name).strip() or canonical_screen_name
                sender = f"@{screen_name}"
                display_name = str(tweet_user_legacy.get("name") or canonical_name).strip() or canonical_name

                full_text = str(tweet_legacy.get("full_text") or tweet_legacy.get("text") or "").strip()
                text = _expand_urls(full_text, tweet_legacy.get("entities"))
                if not text:
                    text = f"{display_name} 发布了新帖"
                subject = text[:120]
                link = f"https://x.com/{screen_name}/status/{tweet_id}"
                preview_image = _extract_first_image_url(tweet_legacy)
                body = _build_preview_body(
                    title=f"{display_name} 发布了新帖",
                    description=text[:1600],
                    link=link,
                    preview_image=preview_image,
                )

                seen_ids.add(tweet_id)
                messages.append(
                    IncomingMessage(
                        source="x",
                        external_id=tweet_id,
                        sender=sender or self._default_sender,
                        subject=subject or f"{sender} 更新",
                        body=body,
                        received_at=created_at,
                        sender_avatar_url=sender_avatar_url,
                    )
                )
        messages.sort(key=lambda item: (item.received_at, item.external_id or ""), reverse=True)
        return messages[: self._max_items]

    def _fetch_via_graphql(self, *, since: datetime | None) -> list[IncomingMessage]:
        if not self._username:
            raise ValueError("X 订阅需要有效用户名")

        with httpx.Client(
            timeout=self._timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": _DEFAULT_USER_AGENT},
            transport=self._transport,
        ) as client:
            profile_url = f"https://x.com/{self._username}"
            profile_response = client.get(profile_url)
            profile_response.raise_for_status()
            profile_html = profile_response.text or ""

            main_js_match = _MAIN_JS_RE.search(profile_html)
            if not main_js_match:
                raise ValueError("未能解析 X 前端脚本地址")
            main_js_url = main_js_match.group(0)

            guest_token = ""
            guest_match = _GUEST_TOKEN_RE.search(profile_html)
            if guest_match:
                guest_token = guest_match.group(1)
            if not guest_token:
                cookie_gt = client.cookies.get("gt")
                guest_token = str(cookie_gt or "").strip()
            if not guest_token:
                raise ValueError("未能获取 X guest token")

            main_js_response = client.get(main_js_url)
            main_js_response.raise_for_status()
            main_js = main_js_response.text or ""

            bearer_match = _BEARER_TOKEN_RE.search(main_js)
            if not bearer_match:
                raise ValueError("未能解析 X bearer token")
            bearer_token = urllib.parse.unquote(bearer_match.group(0))

            user_query_id, user_features, user_toggles = _extract_operation_spec(main_js, "UserByScreenName")
            tweets_query_id, tweets_features, tweets_toggles = _extract_operation_spec(main_js, "UserTweets")

            api_headers = {
                "Authorization": f"Bearer {bearer_token}",
                "x-guest-token": guest_token,
                "x-twitter-active-user": "yes",
                "x-twitter-client-language": "en",
                "Referer": profile_url,
                "User-Agent": _DEFAULT_USER_AGENT,
                "Accept": "*/*",
            }

            user_payload = self._call_graphql(
                client=client,
                operation_name="UserByScreenName",
                query_id=user_query_id,
                variables={
                    "screen_name": self._username,
                    "withSafetyModeUserFields": True,
                },
                feature_switches=user_features,
                field_toggles=user_toggles,
                headers=api_headers,
            )
            user_result = (
                user_payload.get("data", {})
                .get("user", {})
                .get("result", {})
            )
            if not isinstance(user_result, dict):
                raise ValueError("UserByScreenName 响应缺少用户信息")
            rest_id = str(user_result.get("rest_id") or "").strip()
            if not rest_id:
                raise ValueError("UserByScreenName 响应缺少 rest_id")
            user_legacy = user_result.get("legacy") or {}
            if not isinstance(user_legacy, dict):
                user_legacy = {}
            canonical_screen_name = str(user_legacy.get("screen_name") or self._username).strip() or self._username
            canonical_name = str(user_legacy.get("name") or f"@{canonical_screen_name}").strip() or f"@{canonical_screen_name}"
            canonical_avatar_url = _extract_user_avatar_url(user_result, user_legacy)
            timeline_count = min(max(self._max_items, 20), 100)
            max_pages = 2
            entries: list[dict[str, Any]] = []
            cursor: str | None = None
            seen_cursors: set[str] = set()

            for page_idx in range(max_pages):
                if page_idx > 0:
                    time.sleep(2)  # 翻页间延迟，避免触发 429
                variables: dict[str, Any] = {
                    "userId": rest_id,
                    "count": timeline_count,
                    "includePromotedContent": False,
                    "withQuickPromoteEligibilityTweetFields": True,
                    "withVoice": True,
                    "withV2Timeline": True,
                }
                if cursor:
                    variables["cursor"] = cursor

                try:
                        tweets_payload = self._call_graphql(
                        client=client,
                        operation_name="UserTweets",
                        query_id=tweets_query_id,
                        variables=variables,
                        feature_switches=tweets_features,
                        field_toggles=tweets_toggles,
                        headers=api_headers,
                    )
                except _RateLimitError:
                    if entries:
                        break
                    raise

                timeline = (
                    tweets_payload.get("data", {})
                    .get("user", {})
                    .get("result", {})
                    .get("timeline", {})
                    .get("timeline", {})
                )
                instructions = timeline.get("instructions") if isinstance(timeline, dict) else None
                page_entries = _extract_timeline_entries(instructions)
                if not page_entries:
                    break
                entries.extend(page_entries)

                # 已收集足够数据则提前结束
                if len(entries) >= self._max_items:
                    break

                next_cursor = _extract_bottom_cursor(page_entries)
                if not next_cursor or next_cursor in seen_cursors:
                    break
                seen_cursors.add(next_cursor)
                cursor = next_cursor

        return self._parse_graphql_entries(
            entries=entries,
            since=since,
            canonical_screen_name=canonical_screen_name,
            canonical_name=canonical_name,
            canonical_avatar_url=canonical_avatar_url,
        )

    def _fetch_via_rsshub(self, *, since: datetime | None) -> list[IncomingMessage]:
        """通过 RSSHub 获取用户推文（第二优先级回退）"""
        if not self._username:
            raise ValueError("RSSHub 回退需要有效用户名")
        base = os.environ.get("MERCURYDESK_RSSHUB_BASE_URL", "https://rsshub.app").rstrip("/")
        feed_url = f"{base}/x/user/{self._username}"
        # RSSHub 返回的是按时间排序的 Feed，无需进行 strict stale 检查 (那是针对 Guest Token 的乱序问题)
        return FeedConnector(
            feed_url=feed_url,
            source="x",
            default_sender=self._default_sender,
            timeout_seconds=self._timeout_seconds,
            max_entries=self._max_items,
        ).fetch_new_messages(since=since)

    def _fetch_via_nitter(self, *, since: datetime | None) -> list[IncomingMessage]:
        """通过 Nitter 实例的 RSS 获取用户推文（兜底回退）"""
        if not self._username:
            raise ValueError("Nitter 回退需要有效用户名")
        errors: list[str] = []
        for instance in _NITTER_INSTANCES:
            feed_url = f"{instance.rstrip('/')}/{self._username}/rss"
            try:
                msgs = FeedConnector(
                    feed_url=feed_url,
                    source="x",
                    default_sender=self._default_sender,
                    timeout_seconds=self._timeout_seconds,
                    max_entries=self._max_items,
                ).fetch_new_messages(since=since)
                if msgs:  # 非空才返回，空列表继续尝试下一个实例
                    return msgs
                errors.append(f"{instance}: 返回空列表")
            except Exception as e:
                errors.append(f"{instance}: {e}")
        raise ValueError(f"所有 Nitter 实例均失败: {'; '.join(errors)}")

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        errors: list[str] = []

        def _try(label: str, fn: object) -> list[IncomingMessage] | None:
            """尝试执行策略。返回列表(含空列表)=成功；返回 None=失败，继续回退。
            空列表代表「成功连接但没有新消息」，不应视为失败。
            策略函数在真正失败时应抛异常（如网络错误、解析错误等）。"""
            try:
                return fn()  # type: ignore[operator]
            except Exception as e:
                errors.append(f"{label}: {e}")
                return None

        # 第一优先级：官方 X API v2 (需要配置 Bearer Token)
        if self._bearer_token:
            result = _try("Official API", lambda: self._fetch_via_official_api(since=since))
            if result is not None:
                return result

        # 第二优先级：Cookie 认证 GraphQL（返回真实时间线，而非热门推文）
        cookie_auth_available = bool(self._auth_cookies)
        cookie_auth_rate_limited = False
        if cookie_auth_available:
            result = _try("GraphQL(Cookie认证)", lambda: self._fetch_via_graphql_auth(since=since))
            if result is not None:
                return result
            # 如果是 429 限流，等 5 秒重试一次
            if any("被限流" in e for e in errors):
                cookie_auth_rate_limited = True
                import time as _time
                _time.sleep(5)
                result = _try("GraphQL(Cookie认证-重试)", lambda: self._fetch_via_graphql_auth(since=since))
                if result is not None:
                    return result

        # 第三优先级：GraphQL Guest Token（访客模式，部分用户可能只返回热门推文）
        # Guest Token 有独立限流配额，即使 Cookie 认证被限流也应尝试
        result = _try("GraphQL", lambda: self._fetch_via_graphql(since=since))
        if result is not None:
            return result

        # 第四优先级：RSSHub 回退
        result = _try("RSSHub", lambda: self._fetch_via_rsshub(since=since))
        if result is not None:
            return result

        # 第五优先级：Nitter 实例（大部分已失效，仅作兜底）
        result = _try("Nitter", lambda: self._fetch_via_nitter(since=since))
        if result is not None:
            return result

        # 最后回退：用户自定义 RSS 订阅源
        if self._fallback_feed_url:
            result = _try("RSS 回退", lambda: FeedConnector(
                feed_url=self._fallback_feed_url,
                source="x",
                default_sender=self._default_sender,
                timeout_seconds=self._timeout_seconds,
                max_entries=self._max_items,
            ).fetch_new_messages(since=since))
            if result is not None:
                return result

        raise ValueError(f"X 抓取失败: {'; '.join(errors)}")
