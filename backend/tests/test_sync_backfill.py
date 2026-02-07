from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.connectors.base import IncomingMessage
from app.models import Base, ConnectedAccount, Contact, Message, User
import app.sync as sync_module


class _BackfillConnector:
    def __init__(self):
        self.calls: list[datetime | None] = []

    def fetch_new_messages(self, *, since: datetime | None):
        self.calls.append(since)
        if since is not None:
            return []
        return [
            IncomingMessage(
                source="x",
                external_id="1996646348964413572",
                sender="@yetone",
                subject="测试推文",
                body="测试内容",
                received_at=datetime(2025, 12, 4, 18, 22, 40, tzinfo=timezone.utc),
                sender_avatar_url="https://pbs.twimg.com/profile_images/example_normal.jpg",
            )
        ]


def test_sync_account_backfills_x_when_incremental_empty(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)

    connector = _BackfillConnector()
    monkeypatch.setattr(sync_module, "_connector_for", lambda _db, _account: connector)

    with Session(engine) as db:
        user = User(email="sync-test@example.com", hashed_password="hashed")
        db.add(user)
        db.flush()

        account = ConnectedAccount(
            user_id=user.id,
            provider="x",
            identifier="x:yetone",
            last_synced_at=datetime(2026, 2, 6, 20, 33, 42, tzinfo=timezone.utc),
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        inserted = sync_module.sync_account(db, account=account)
        assert inserted == 1
        assert len(connector.calls) == 2
        assert connector.calls[0] is not None
        assert connector.calls[0].tzinfo is not None
        assert connector.calls[1] is None

        message = db.scalar(
            select(Message).where(
                Message.user_id == user.id,
                Message.source == "x",
                Message.external_id == "1996646348964413572",
            )
        )
        assert message is not None

        contact = db.scalar(
            select(Contact).where(
                Contact.user_id == user.id,
                Contact.handle == "@yetone",
            )
        )
        assert contact is not None
        assert contact.avatar_url == "https://pbs.twimg.com/profile_images/example_normal.jpg"
