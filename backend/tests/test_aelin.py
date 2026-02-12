from __future__ import annotations

import tempfile
import time

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.routers.aelin as aelin_router
from app.db import init_engine
from app.main import create_app
from app.models import Base
from app.services.web_search import WebSearchResult
from app.settings import settings


def _create_test_client() -> TestClient:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)

    init_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    import app.db as db_module

    db_module._engine = engine  # type: ignore[attr-defined]
    db_module._SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)  # type: ignore[attr-defined]

    tmp_media = tempfile.TemporaryDirectory()
    settings.media_dir = tmp_media.name
    app = create_app()
    client = TestClient(app)
    client._tmp_media = tmp_media  # type: ignore[attr-defined]
    return client


def _auth_headers(client: TestClient) -> dict[str, str]:
    reg = client.post("/api/v1/auth/register", json={"email": "aelin@example.com", "password": "password123"})
    assert reg.status_code == 200, reg.text
    login = client.post(
        "/api/v1/auth/token",
        data={"username": "aelin@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _sync_and_wait(client: TestClient, headers: dict[str, str], account_id: int) -> None:
    started = client.post(f"/api/v1/accounts/{account_id}/sync", headers=headers)
    assert started.status_code in {200, 202}, started.text
    payload = started.json()
    if payload.get("status") == "succeeded":
        return
    job_id = payload.get("job_id")
    assert isinstance(job_id, str) and job_id
    for _ in range(200):
        resp = client.get(f"/api/v1/accounts/sync-jobs/{job_id}", headers=headers)
        assert resp.status_code == 200, resp.text
        job = resp.json()
        if job.get("status") == "succeeded":
            return
        if job.get("status") == "failed":
            raise AssertionError(f"sync failed: {job.get('error')}")
        time.sleep(0.05)
    raise AssertionError("sync timed out")


def test_aelin_context_and_chat_endpoints():
    client = _create_test_client()
    unauthorized = client.get("/api/v1/aelin/context")
    assert unauthorized.status_code == 401, unauthorized.text

    headers = _auth_headers(client)
    acct = client.post(
        "/api/v1/accounts",
        json={"provider": "mock", "identifier": "demo", "access_token": "x"},
        headers=headers,
    )
    assert acct.status_code == 200, acct.text
    _sync_and_wait(client, headers, int(acct.json()["id"]))

    ctx = client.get("/api/v1/aelin/context?workspace=life", headers=headers)
    assert ctx.status_code == 200, ctx.text
    ctx_data = ctx.json()
    assert ctx_data.get("workspace") == "life"
    assert "summary" in ctx_data
    assert isinstance(ctx_data.get("focus_items"), list)
    assert isinstance(ctx_data.get("notes"), list)
    assert isinstance(ctx_data.get("todos"), list)
    assert isinstance(ctx_data.get("pin_recommendations"), list)
    assert isinstance(ctx_data.get("layout_cards"), list)
    assert isinstance(ctx_data.get("daily_brief"), dict)
    assert "generated_at" in ctx_data

    chat = client.post(
        "/api/v1/aelin/chat",
        json={
            "query": "我最近最值得关注的更新是什么？",
            "use_memory": True,
            "max_citations": 6,
            "workspace": "life",
            "images": [
                {
                    "name": "demo.png",
                    "data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF7AL5n4VHKwAAAABJRU5ErkJggg==",
                }
            ],
        },
        headers=headers,
    )
    assert chat.status_code == 200, chat.text
    chat_data = chat.json()
    assert isinstance(chat_data.get("answer"), str) and chat_data.get("answer")
    assert isinstance(chat_data.get("citations"), list)
    assert isinstance(chat_data.get("actions"), list)
    assert "memory_summary" in chat_data
    assert "generated_at" in chat_data

    chat_smalltalk = client.post(
        "/api/v1/aelin/chat",
        json={
            "query": "你好，我今天有点焦虑，想跟你聊聊。",
            "use_memory": True,
            "max_citations": 6,
            "workspace": "life",
            "images": [],
        },
        headers=headers,
    )
    assert chat_smalltalk.status_code == 200, chat_smalltalk.text
    chat_smalltalk_data = chat_smalltalk.json()
    assert isinstance(chat_smalltalk_data.get("answer"), str) and chat_smalltalk_data.get("answer")
    # Casual chat should not be forced into retrieval listing mode.
    assert chat_smalltalk_data.get("citations") == []


def test_aelin_track_confirm_endpoint(monkeypatch):
    client = _create_test_client()
    headers = _auth_headers(client)

    missing = client.post(
        "/api/v1/aelin/track/confirm",
        json={"target": "NBA", "source": "x", "query": "跟踪 NBA 动态"},
        headers=headers,
    )
    assert missing.status_code == 200, missing.text
    missing_data = missing.json()
    assert missing_data.get("status") == "needs_config"
    assert missing_data.get("provider") == "x"
    assert any((it.get("kind") == "open_settings") for it in (missing_data.get("actions") or []))

    monkeypatch.setattr(
        aelin_router._web_search,
        "search",
        lambda query, max_results=6: [
            WebSearchResult(
                title="Warriors beat Spurs 130-119",
                url="https://example.com/nba/game",
                snippet="Curry scored 30 with 6 threes.",
            )
        ],
    )
    ok = client.post(
        "/api/v1/aelin/track/confirm",
        json={"target": "NBA 比赛", "source": "web", "query": "NBA 马刺 勇士"},
        headers=headers,
    )
    assert ok.status_code == 200, ok.text
    ok_data = ok.json()
    assert ok_data.get("status") == "tracking_enabled"
    assert ok_data.get("provider") == "web"


def test_aelin_chat_can_use_web_search_plan(monkeypatch):
    client = _create_test_client()
    headers = _auth_headers(client)

    monkeypatch.setattr(
        aelin_router,
        "_plan_tool_usage",
        lambda **kwargs: {
            "need_local_search": False,
            "need_web_search": True,
            "web_queries": ["NBA 马刺 勇士"],
            "track_suggestion": {
                "target": "NBA 比赛",
                "source": "web",
                "reason": "你最近在问比赛结果，适合持续跟踪。",
            },
            "reason": "test_plan",
        },
    )
    monkeypatch.setattr(
        aelin_router._web_search,
        "search",
        lambda query, max_results=6: [
            WebSearchResult(
                title="Warriors 130-119 Spurs",
                url="https://example.com/nba/box",
                snippet="Curry drops 30 with 6 threes.",
            )
        ],
    )

    resp = client.post(
        "/api/v1/aelin/chat",
        json={"query": "今天马刺和勇士比赛结果如何？", "use_memory": True, "workspace": "default"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data.get("answer"), str) and data.get("answer")
    assert isinstance(data.get("citations"), list)
    assert any((it.get("source") == "web") for it in data.get("citations") or [])
    assert any((it.get("kind") == "confirm_track") for it in data.get("actions") or [])
