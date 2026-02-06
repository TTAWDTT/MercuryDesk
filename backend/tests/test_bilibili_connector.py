from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.connectors.bilibili import BilibiliConnector

_VIDEO_PAGE_MARKDOWN = """
Title: test

Markdown Content:
[video a](https://www.bilibili.com/video/BV1111111111/)
[video a duplicate](https://www.bilibili.com/video/BV1111111111/)
[video b](https://www.bilibili.com/video/BV2222222222/)
"""


def _build_transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "r.jina.ai":
            if request.url.path.endswith("/video"):
                return httpx.Response(200, text=_VIDEO_PAGE_MARKDOWN)
            return httpx.Response(200, text="")

        if request.url.host == "api.bilibili.com" and request.url.path.endswith("/x/web-interface/view"):
            bvid = str(request.url.params.get("bvid") or "")
            if bvid == "BV1111111111":
                return httpx.Response(
                    200,
                    json={
                        "code": 0,
                        "data": {
                            "bvid": bvid,
                            "title": "Video 1",
                            "desc": "desc 1",
                            "pubdate": 1700000000,
                            "pic": "//img.example.com/1.jpg",
                            "owner": {"name": "UP One", "face": "https://img.example.com/up.jpg"},
                        },
                    },
                )
            if bvid == "BV2222222222":
                return httpx.Response(
                    200,
                    json={
                        "code": 0,
                        "data": {
                            "bvid": bvid,
                            "title": "Video 2",
                            "desc": "desc 2",
                            "pubdate": 1700001000,
                            "pic": "http://img.example.com/2.jpg",
                            "owner": {"name": "UP One", "face": "https://img.example.com/up.jpg"},
                        },
                    },
                )
            return httpx.Response(200, json={"code": -404})

        raise AssertionError(f"unexpected request: {request.method} {request.url!s}")

    return httpx.MockTransport(handler)


def test_bilibili_connector_fetches_and_deduplicates_bvids():
    connector = BilibiliConnector(
        uid="bilibili:174501086",
        transport=_build_transport(),
        max_items=10,
    )

    messages = connector.fetch_new_messages(since=None)

    assert [message.external_id for message in messages] == ["BV1111111111", "BV2222222222"]
    assert messages[0].sender == "UP One"
    assert messages[0].received_at.tzinfo is not None
    assert "https://www.bilibili.com/video/BV1111111111/" in messages[0].body
    assert "https://img.example.com/1.jpg" in messages[0].body
    assert messages[0].sender_avatar_url == "https://img.example.com/up.jpg"


def test_bilibili_connector_applies_since_filter():
    connector = BilibiliConnector(
        uid="https://space.bilibili.com/174501086/video",
        transport=_build_transport(),
        max_items=10,
    )

    since = datetime.fromtimestamp(1700000500, tz=timezone.utc)
    messages = connector.fetch_new_messages(since=since)

    assert [message.external_id for message in messages] == ["BV2222222222"]
