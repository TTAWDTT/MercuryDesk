from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import init_engine
from app.main import create_app
from app.models import Base


def test_register_login_sync_and_list():
    # In-memory SQLite for tests (single-connection StaticPool semantics via connect_args).
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)

    # Point app DB helpers at the test engine
    init_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    # Replace the global engine with our actual test engine to ensure data persists for the duration of the test.
    import app.db as db_module

    db_module._engine = engine  # type: ignore[attr-defined]
    db_module._SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)  # type: ignore[attr-defined]

    app = create_app()
    client = TestClient(app)

    # Register
    reg = client.post("/api/v1/auth/register", json={"email": "demo@example.com", "password": "password123"})
    assert reg.status_code == 200, reg.text

    # Login
    token = client.post(
        "/api/v1/auth/token",
        data={"username": "demo@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert token.status_code == 200, token.text
    access_token = token.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Create a mock connected account
    acct = client.post(
        "/api/v1/accounts",
        json={"provider": "mock", "identifier": "demo", "access_token": "x"},
        headers=headers,
    )
    assert acct.status_code == 200, acct.text
    account_id = acct.json()["id"]

    # IMAP accounts should require configuration.
    bad_imap = client.post(
        "/api/v1/accounts",
        json={"provider": "imap", "identifier": "demo@example.com"},
        headers=headers,
    )
    assert bad_imap.status_code == 400, bad_imap.text

    # Create an IMAP connected account (config stored; sync not exercised in tests).
    imap_acct = client.post(
        "/api/v1/accounts",
        json={
            "provider": "imap",
            "identifier": "demo@example.com",
            "imap_host": "imap.example.com",
            "imap_port": 993,
            "imap_use_ssl": True,
            "imap_username": "demo@example.com",
            "imap_password": "password",
            "imap_mailbox": "INBOX",
        },
        headers=headers,
    )
    assert imap_acct.status_code == 200, imap_acct.text

    # Sync it
    sync = client.post(f"/api/v1/accounts/{account_id}/sync", headers=headers)
    assert sync.status_code == 200, sync.text
    assert sync.json()["inserted"] >= 1

    accounts = client.get("/api/v1/accounts", headers=headers)
    assert accounts.status_code == 200, accounts.text
    assert any(a["provider"] == "imap" for a in accounts.json())

    # List contacts
    contacts = client.get("/api/v1/contacts", headers=headers)
    assert contacts.status_code == 200, contacts.text
    contacts_data = contacts.json()
    assert len(contacts_data) >= 1

    contact_id = contacts_data[0]["id"]
    assert contacts_data[0]["unread_count"] >= 1
    assert "latest_preview" in contacts_data[0]

    messages = client.get(f"/api/v1/contacts/{contact_id}/messages", headers=headers)
    assert messages.status_code == 200, messages.text
    msgs = messages.json()
    assert len(msgs) >= 1
    assert msgs[0]["summary"] is not None

    # Pagination via before_id should work (one message per sender in mock data).
    before = client.get(f"/api/v1/contacts/{contact_id}/messages?limit=50&before_id={msgs[0]['id']}", headers=headers)
    assert before.status_code == 200, before.text
    assert before.json() == []

    # Mark-read should bulk update and drop unread count to 0.
    mark = client.post(f"/api/v1/contacts/{contact_id}/mark-read", headers=headers)
    assert mark.status_code == 200, mark.text
    assert mark.json()["marked"] >= 1

    contacts2 = client.get("/api/v1/contacts", headers=headers)
    assert contacts2.status_code == 200, contacts2.text
    updated = [c for c in contacts2.json() if c["id"] == contact_id][0]
    assert updated["unread_count"] == 0
