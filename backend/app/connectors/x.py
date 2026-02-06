from __future__ import annotations

import json
import re
import urllib.parse
from datetime import datetime, timezone
from html import escape, unescape
from typing import Any

import httpx

from app.connectors.base import IncomingMessage
from app.connectors.feed import FeedConnector

_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
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
    ):
        self._username = _normalize_username(username)
        self._fallback_feed_url = (fallback_feed_url or "").strip() or None
        self._default_sender = (default_sender or self._username or "x").strip()
        self._timeout_seconds = max(5, timeout_seconds)
        self._max_items = max(1, max_items)
        self._transport = transport

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

            tweets_payload = self._call_graphql(
                client=client,
                operation_name="UserTweets",
                query_id=tweets_query_id,
                variables={
                    "userId": rest_id,
                    "count": self._max_items,
                    "includePromotedContent": False,
                    "withQuickPromoteEligibilityTweetFields": True,
                    "withVoice": True,
                    "withV2Timeline": True,
                },
                feature_switches=tweets_features,
                field_toggles=tweets_toggles,
                headers=api_headers,
            )

        timeline = (
            tweets_payload.get("data", {})
            .get("user", {})
            .get("result", {})
            .get("timeline", {})
            .get("timeline", {})
        )
        instructions = timeline.get("instructions") if isinstance(timeline, dict) else None
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

        since_utc = since.astimezone(timezone.utc) if since is not None else None
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
                created_at = _parse_x_datetime(tweet_legacy.get("created_at")) or datetime.now(timezone.utc)
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
                    )
                )
                if len(messages) >= self._max_items:
                    return messages
        return messages

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        try:
            return self._fetch_via_graphql(since=since)
        except Exception as primary_error:
            if self._fallback_feed_url:
                try:
                    return FeedConnector(
                        feed_url=self._fallback_feed_url,
                        source="x",
                        default_sender=self._default_sender,
                        timeout_seconds=self._timeout_seconds,
                        max_entries=self._max_items,
                    ).fetch_new_messages(since=since)
                except Exception as fallback_error:
                    raise ValueError(
                        f"X 抓取失败: {primary_error}; RSS 回退失败: {fallback_error}"
                    ) from fallback_error
            raise ValueError(f"X 抓取失败: {primary_error}") from primary_error
