from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class IncomingMessage:
    source: str
    external_id: str | None
    sender: str
    subject: str
    body: str
    received_at: datetime
    sender_avatar_url: str | None = None


class Connector(Protocol):
    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]: ...
