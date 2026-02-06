from __future__ import annotations


_FEED_URL_REWRITES: dict[str, str] = {
    "https://www.anthropic.com/news/rss.xml": "https://claude.com/blog/",
    "https://www.anthropic.com/news/rss.xml/": "https://claude.com/blog/",
}


def normalize_feed_url(feed_url: str) -> str:
    normalized = feed_url.strip()
    if not normalized:
        return normalized
    return _FEED_URL_REWRITES.get(normalized, normalized)
