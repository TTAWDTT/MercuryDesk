from __future__ import annotations

import json
import re
from datetime import datetime, timezone

import httpx

from app.connectors.x import XConnector

_USER_QUERY_ID = "userByScreenNameQueryABC1234"
_TWEETS_QUERY_ID = "userTweetsQueryDEF56789012"
_BEARER_TOKEN = "AAAAA" + ("B" * 70)

_PROFILE_HTML = """
<html>
  <head>
    <script>document.cookie="gt=9876543210; Max-Age=9000; Domain=.x.com; Path=/; Secure";</script>
    <script src="https://abs.twimg.com/responsive-web/client-web/main.mockbundle.js"></script>
  </head>
  <body></body>
</html>
"""

_MAIN_JS = f"""
const bearerToken = "{_BEARER_TOKEN}";
e.exports={{queryId:"{_USER_QUERY_ID}",operationName:"UserByScreenName",operationType:"query",metadata:{{featureSwitches:["uf_1","uf_2"],fieldToggles:["ut_1"]}}}};
e.exports={{queryId:"{_TWEETS_QUERY_ID}",operationName:"UserTweets",operationType:"query",metadata:{{featureSwitches:["tf_1"],fieldToggles:["tt_1","tt_2"]}}}};
"""

_USER_RESPONSE = {
    "data": {
        "user": {
            "result": {
                "rest_id": "4398626122",
                "avatar": {"image_url": "https://pbs.twimg.com/profile_images/openai_normal.jpg"},
                "legacy": {
                    "screen_name": "openai",
                    "name": "OpenAI",
                    "profile_image_url_https": "https://pbs.twimg.com/profile_images/openai_legacy_normal.jpg",
                },
            }
        }
    }
}

_TWEETS_RESPONSE = {
    "data": {
        "user": {
            "result": {
                "timeline": {
                    "timeline": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "tweet-200",
                                        "content": {
                                            "itemContent": {
                                                "tweet_results": {
                                                    "result": {
                                                        "__typename": "Tweet",
                                                        "rest_id": "200",
                                                        "legacy": {
                                                            "full_text": "Alpha post https://t.co/aaa https://t.co/media1",
                                                            "created_at": "Thu Feb 05 08:00:00 +0000 2026",
                                                            "entities": {
                                                                "urls": [
                                                                    {
                                                                        "url": "https://t.co/aaa",
                                                                        "expanded_url": "https://example.com/alpha",
                                                                    }
                                                                ],
                                                                "media": [{"url": "https://t.co/media1"}],
                                                            },
                                                            "extended_entities": {
                                                                "media": [
                                                                    {"media_url_https": "https://img.example.com/alpha.jpg"}
                                                                ]
                                                            },
                                                        },
                                                        "core": {
                                                            "user_results": {
                                                                "result": {
                                                                    "legacy": {
                                                                        "screen_name": "openai",
                                                                        "name": "OpenAI",
                                                                        "profile_image_url_https": "https://pbs.twimg.com/profile_images/user_normal.jpg",
                                                                    }
                                                                }
                                                            }
                                                        },
                                                    }
                                                }
                                            }
                                        },
                                    },
                                    {
                                        "entryId": "profile-conversation-201",
                                        "content": {
                                            "items": [
                                                {
                                                    "item": {
                                                        "itemContent": {
                                                            "tweet_results": {
                                                                "result": {
                                                                    "__typename": "TweetWithVisibilityResults",
                                                                    "tweet": {
                                                                        "__typename": "Tweet",
                                                                        "rest_id": "201",
                                                                        "legacy": {
                                                                            "full_text": "Beta update",
                                                                            "created_at": "Thu Feb 05 10:30:00 +0000 2026",
                                                                            "entities": {},
                                                                        },
                                                                        "core": {
                                                                            "user_results": {
                                                                                "result": {
                                                                                    "legacy": {
                                                                                        "screen_name": "openai",
                                                                                        "name": "OpenAI",
                                                                                        "profile_image_url_https": "https://pbs.twimg.com/profile_images/user_normal.jpg",
                                                                                    }
                                                                                }
                                                                            }
                                                                        },
                                                                    },
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            ]
                                        },
                                    },
                                ],
                            }
                        ]
                    }
                }
            }
        }
    }
}


def _build_transport(
    user_response: dict | None = None,
    tweets_response: dict | None = None,
    tweets_pages: dict[str | None, dict] | None = None,
) -> httpx.MockTransport:
    effective_user_response = user_response or _USER_RESPONSE
    effective_tweets_response = tweets_response or _TWEETS_RESPONSE
    effective_tweets_pages = tweets_pages or {}

    def handler(request: httpx.Request) -> httpx.Response:
        if (
            request.url.host == "x.com"
            and re.fullmatch(r"/[A-Za-z0-9_]+", request.url.path or "")
        ):
            return httpx.Response(200, text=_PROFILE_HTML)

        if request.url.host == "abs.twimg.com" and request.url.path.endswith("/main.mockbundle.js"):
            return httpx.Response(200, text=_MAIN_JS)

        if request.url.host == "x.com" and request.url.path.endswith(f"/{_USER_QUERY_ID}/UserByScreenName"):
            features = json.loads(request.url.params.get("features", "{}"))
            field_toggles = json.loads(request.url.params.get("fieldToggles", "{}"))
            assert features == {"uf_1": False, "uf_2": False}
            assert field_toggles == {"ut_1": False}
            assert request.headers.get("x-guest-token") == "9876543210"
            return httpx.Response(200, json=effective_user_response)

        if request.url.host == "x.com" and request.url.path.endswith(f"/{_TWEETS_QUERY_ID}/UserTweets"):
            features = json.loads(request.url.params.get("features", "{}"))
            field_toggles = json.loads(request.url.params.get("fieldToggles", "{}"))
            assert features == {"tf_1": False}
            assert field_toggles == {"tt_1": False, "tt_2": False}
            variables = json.loads(request.url.params.get("variables", "{}"))
            cursor = variables.get("cursor")
            if cursor in effective_tweets_pages:
                return httpx.Response(200, json=effective_tweets_pages[cursor])
            if cursor is None and None in effective_tweets_pages:
                return httpx.Response(200, json=effective_tweets_pages[None])
            return httpx.Response(200, json=effective_tweets_response)

        raise AssertionError(f"unexpected request: {request.method} {request.url!s}")

    return httpx.MockTransport(handler)


def test_x_connector_fetches_from_x_graphql():
    connector = XConnector(
        username="@openai",
        transport=_build_transport(),
        max_items=10,
    )
    messages = connector.fetch_new_messages(since=None)

    assert [message.external_id for message in messages] == ["201", "200"]
    assert all(message.source == "x" for message in messages)
    assert all(message.sender == "@openai" for message in messages)
    assert any("https://example.com/alpha" in message.body for message in messages)
    assert any("https://img.example.com/alpha.jpg" in message.body for message in messages)
    assert all("https://t.co/media1" not in message.subject for message in messages)
    assert messages[0].received_at.tzinfo is not None
    assert all(message.sender_avatar_url == "https://pbs.twimg.com/profile_images/user_normal.jpg" for message in messages)


def test_x_connector_applies_since_filter():
    connector = XConnector(
        username="openai",
        transport=_build_transport(),
        max_items=10,
    )
    since = datetime(2026, 2, 5, 9, 0, tzinfo=timezone.utc)
    messages = connector.fetch_new_messages(since=since)

    assert [message.external_id for message in messages] == ["201", "200"]


def test_x_connector_accepts_partial_dependency_error_when_data_exists():
    user_response_with_dependency_error = {
        "errors": [
            {
                "message": "Dependency: Unspecified",
                "path": ["user", "result", "legacy_extended_profile"],
            }
        ],
        "data": _USER_RESPONSE["data"],
    }
    connector = XConnector(
        username="yetone",
        transport=_build_transport(user_response=user_response_with_dependency_error),
        max_items=10,
    )

    messages = connector.fetch_new_messages(since=None)

    assert [message.external_id for message in messages] == ["201", "200"]


def test_x_connector_uses_snowflake_time_and_sorts_latest_first():
    response_with_missing_created_at = {
        "data": {
            "user": {
                "result": {
                    "timeline": {
                        "timeline": {
                            "instructions": [
                                {
                                    "type": "TimelineAddEntries",
                                    "entries": [
                                        {
                                            "entryId": "tweet-2000000000000000000",
                                            "content": {
                                                "itemContent": {
                                                    "tweet_results": {
                                                        "result": {
                                                            "__typename": "Tweet",
                                                            "rest_id": "2000000000000000000",
                                                            "legacy": {
                                                                "full_text": "older",
                                                                "entities": {},
                                                            },
                                                            "core": {"user_results": {"result": {"legacy": {"screen_name": "openai"}}}},
                                                        }
                                                    }
                                                }
                                            },
                                        },
                                        {
                                            "entryId": "tweet-2010000000000000000",
                                            "content": {
                                                "itemContent": {
                                                    "tweet_results": {
                                                        "result": {
                                                            "__typename": "Tweet",
                                                            "rest_id": "2010000000000000000",
                                                            "legacy": {
                                                                "full_text": "newer",
                                                                "entities": {},
                                                            },
                                                            "core": {"user_results": {"result": {"legacy": {"screen_name": "openai"}}}},
                                                        }
                                                    }
                                                }
                                            },
                                        },
                                    ],
                                }
                            ]
                        }
                    }
                }
            }
        }
    }

    connector = XConnector(
        username="openai",
        transport=_build_transport(tweets_response=response_with_missing_created_at),
        max_items=10,
    )
    messages = connector.fetch_new_messages(since=None)

    assert [message.external_id for message in messages][:2] == ["2010000000000000000", "2000000000000000000"]


def test_x_connector_follows_bottom_cursor_for_next_page():
    first_page = {
        "data": {
            "user": {
                "result": {
                    "timeline": {
                        "timeline": {
                            "instructions": [
                                {
                                    "type": "TimelineAddEntries",
                                    "entries": [
                                        {
                                            "entryId": "tweet-2020000000000000000",
                                            "content": {
                                                "itemContent": {
                                                    "tweet_results": {
                                                        "result": {
                                                            "__typename": "Tweet",
                                                            "rest_id": "2020000000000000000",
                                                            "legacy": {"full_text": "page1", "entities": {}},
                                                            "core": {"user_results": {"result": {"legacy": {"screen_name": "openai"}}}},
                                                        }
                                                    }
                                                }
                                            },
                                        },
                                        {
                                            "entryId": "cursor-bottom-1",
                                            "content": {"value": "CURSOR_2", "cursorType": "Bottom"},
                                        },
                                    ],
                                }
                            ]
                        }
                    }
                }
            }
        }
    }
    second_page = {
        "data": {
            "user": {
                "result": {
                    "timeline": {
                        "timeline": {
                            "instructions": [
                                {
                                    "type": "TimelineAddEntries",
                                    "entries": [
                                        {
                                            "entryId": "tweet-2030000000000000000",
                                            "content": {
                                                "itemContent": {
                                                    "tweet_results": {
                                                        "result": {
                                                            "__typename": "Tweet",
                                                            "rest_id": "2030000000000000000",
                                                            "legacy": {"full_text": "page2", "entities": {}},
                                                            "core": {"user_results": {"result": {"legacy": {"screen_name": "openai"}}}},
                                                        }
                                                    }
                                                }
                                            },
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                }
            }
        }
    }

    connector = XConnector(
        username="openai",
        transport=_build_transport(
            tweets_pages={
                None: first_page,
                "CURSOR_2": second_page,
            }
        ),
        max_items=10,
    )
    messages = connector.fetch_new_messages(since=None)

    external_ids = [message.external_id for message in messages]
    assert "2020000000000000000" in external_ids
    assert "2030000000000000000" in external_ids
