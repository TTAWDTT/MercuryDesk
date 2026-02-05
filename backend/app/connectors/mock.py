from __future__ import annotations

from datetime import datetime, timezone

from app.connectors.base import IncomingMessage


class MockConnector:
    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        base = datetime(2026, 2, 5, 12, 0, tzinfo=timezone.utc)
        msgs = [
            IncomingMessage(
                source="mock",
                external_id="mock-1",
                sender="alice@example.com",
                subject="Welcome to MercuryDesk",
                body="Hi! This is a demo message to show sender-centric aggregation.",
                received_at=base,
            ),
            IncomingMessage(
                source="mock",
                external_id="mock-2",
                sender="octocat@github",
                subject="PR review requested",
                body="Please take a look at my pull request when you have time.",
                received_at=base.replace(hour=13),
            ),
        ]
        if since is None:
            return msgs
        return [m for m in msgs if m.received_at > since]

