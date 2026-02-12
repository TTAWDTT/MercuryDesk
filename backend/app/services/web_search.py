from __future__ import annotations

from dataclasses import dataclass
from html import unescape
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx


def _clean(text: str, limit: int = 500) -> str:
    stripped = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()
    if len(stripped) <= limit:
        return stripped
    return stripped[: max(0, limit - 1)].rstrip() + "…"


def _extract_domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower().strip()
        return host or "web"
    except Exception:
        return "web"


def _decode_duckduckgo_redirect(url: str) -> str:
    try:
        parsed = urlparse(url)
        if parsed.netloc.endswith("duckduckgo.com") and parsed.path == "/l/":
            uddg = parse_qs(parsed.query).get("uddg", [])
            if uddg:
                return unquote(uddg[0])
    except Exception:
        return url
    return url


@dataclass
class WebSearchResult:
    title: str
    url: str
    snippet: str
    source: str = "web"


class WebSearchService:
    def __init__(self, *, timeout_seconds: float = 10.0):
        self.timeout_seconds = timeout_seconds

    def search(self, query: str, *, max_results: int = 6) -> list[WebSearchResult]:
        q = (query or "").strip()
        if not q:
            return []
        n = max(1, min(10, int(max_results or 6)))

        rows = self._search_duckduckgo_lite(q, max_results=n)
        if not rows:
            rows = self._search_duckduckgo_instant(q, max_results=n)
        if not rows:
            return []

        dedup: dict[str, WebSearchResult] = {}
        for row in rows:
            key = (row.url or "").strip().lower() or row.title.lower()
            if not key or key in dedup:
                continue
            dedup[key] = row
            if len(dedup) >= n:
                break
        return list(dedup.values())[:n]

    def _search_duckduckgo_lite(self, query: str, *, max_results: int) -> list[WebSearchResult]:
        url = "https://lite.duckduckgo.com/lite/"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
            )
        }
        try:
            with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True, headers=headers) as client:
                resp = client.get(url, params={"q": query})
            if resp.status_code != 200:
                return []
            html_text = resp.text or ""
        except Exception:
            return []

        # DuckDuckGo Lite page structure: link rows + optional snippet rows.
        rows: list[WebSearchResult] = []
        matches = list(
            re.finditer(
                r'<a[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
                html_text,
                flags=re.IGNORECASE | re.DOTALL,
            )
        )
        for m in matches:
            raw_href = unescape(m.group("href") or "").strip()
            title = _clean(unescape(m.group("title") or ""), limit=180)
            if not raw_href or not title:
                continue
            href = _decode_duckduckgo_redirect(raw_href)
            if not href.startswith("http"):
                continue
            tail = html_text[m.end() : m.end() + 600]
            snippet_match = re.search(r"<td[^>]*>(.*?)</td>", tail, flags=re.IGNORECASE | re.DOTALL)
            snippet_raw = snippet_match.group(1) if snippet_match else ""
            snippet = _clean(unescape(snippet_raw), limit=320)
            if not snippet:
                snippet = f"来源：{_extract_domain(href)}"
            rows.append(WebSearchResult(title=title, url=href, snippet=snippet))
            if len(rows) >= max_results:
                break
        return rows

    def _search_duckduckgo_instant(self, query: str, *, max_results: int) -> list[WebSearchResult]:
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query,
            "format": "json",
            "no_html": 1,
            "skip_disambig": 0,
            "t": "aelin",
        }
        try:
            with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
                resp = client.get(url, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        rows: list[WebSearchResult] = []
        abstract = _clean(str(data.get("AbstractText") or ""), limit=320)
        abstract_url = str(data.get("AbstractURL") or "").strip()
        heading = _clean(str(data.get("Heading") or ""), limit=180)
        if abstract and abstract_url:
            rows.append(WebSearchResult(title=heading or "DuckDuckGo", url=abstract_url, snippet=abstract))

        def _walk_related(items: list[Any]) -> None:
            for item in items:
                if len(rows) >= max_results:
                    return
                if not isinstance(item, dict):
                    continue
                if isinstance(item.get("Topics"), list):
                    _walk_related(item["Topics"])
                    continue
                text = _clean(str(item.get("Text") or ""), limit=260)
                first_url = str(item.get("FirstURL") or "").strip()
                if not text or not first_url:
                    continue
                title = text.split(" - ", 1)[0].strip() or _extract_domain(first_url)
                rows.append(WebSearchResult(title=_clean(title, 160), url=first_url, snippet=text))

        _walk_related(list(data.get("RelatedTopics") or []))
        return rows[:max_results]
