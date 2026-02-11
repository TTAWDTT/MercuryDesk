from __future__ import annotations

import tempfile
import time

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import init_engine
from app.main import create_app
from app.models import Base
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

    # Keep directory alive for the whole test process.
    client._tmp_media = tmp_media  # type: ignore[attr-defined]
    return client


def _auth_headers(client: TestClient) -> dict[str, str]:
    reg = client.post("/api/v1/auth/register", json={"email": "memory@example.com", "password": "password123"})
    assert reg.status_code == 200, reg.text

    login = client.post(
        "/api/v1/auth/token",
        data={"username": "memory@example.com", "password": "password123"},
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


def test_agent_memory_endpoints():
    client = _create_test_client()
    headers = _auth_headers(client)

    acct = client.post(
        "/api/v1/accounts",
        json={"provider": "mock", "identifier": "demo", "access_token": "x"},
        headers=headers,
    )
    assert acct.status_code == 200, acct.text
    _sync_and_wait(client, headers, acct.json()["id"])

    memory = client.get("/api/v1/agent/memory", headers=headers)
    assert memory.status_code == 200, memory.text
    data = memory.json()
    assert "summary" in data
    assert isinstance(data.get("notes"), list)
    assert isinstance(data.get("focus_items"), list)
    assert len(data.get("focus_items", [])) >= 1

    add_note = client.post(
        "/api/v1/agent/memory/notes",
        json={"content": "我最近关注 AI 出海工具类帖子", "kind": "preference"},
        headers=headers,
    )
    assert add_note.status_code == 200, add_note.text
    note = add_note.json()
    assert note["kind"] == "preference"
    assert "AI 出海工具类帖子" in note["content"]

    memory2 = client.get("/api/v1/agent/memory?query=AI", headers=headers)
    assert memory2.status_code == 200, memory2.text
    notes = memory2.json().get("notes", [])
    assert any("AI 出海工具类帖子" in n.get("content", "") for n in notes)

    layout = client.post(
        "/api/v1/agent/memory/layout",
        json={
            "cards": [
                {
                    "contact_id": 1,
                    "display_name": "MercuryDesk 编辑台",
                    "pinned": True,
                    "order": 0,
                    "x": 16,
                    "y": 10,
                    "width": 380,
                    "height": 320,
                },
                {
                    "contact_id": 2,
                    "display_name": "octocat",
                    "pinned": False,
                    "order": 1,
                    "x": 420,
                    "y": 144,
                    "width": 296,
                    "height": 354,
                },
            ]
        },
        headers=headers,
    )
    assert layout.status_code == 200, layout.text
    assert layout.json()["ok"] is True

    deleted = client.delete(f"/api/v1/agent/memory/notes/{note['id']}", headers=headers)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["deleted"] is True

    chat = client.post(
        "/api/v1/agent/chat",
        json={
            "messages": [{"role": "user", "content": "帮我找找最近更新"}],
            "tools": ["search_messages"],
            "use_memory": True,
        },
        headers=headers,
    )
    assert chat.status_code == 200, chat.text
