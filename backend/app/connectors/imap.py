from __future__ import annotations

from datetime import datetime, timezone
from email.header import decode_header
from email.parser import BytesParser
from imaplib import IMAP4_SSL

from app.connectors.base import IncomingMessage


class ImapConnector:
    def __init__(self, *, host: str, username: str, access_token: str, mailbox: str = "INBOX"):
        self._host = host
        self._username = username
        self._access_token = access_token
        self._mailbox = mailbox

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        # Note: This is a minimal skeleton. Production code should handle paging, retries, and token refresh.
        messages: list[IncomingMessage] = []
        with IMAP4_SSL(self._host) as imap:
            imap.authenticate("XOAUTH2", lambda _: f"user={self._username}\1auth=Bearer {self._access_token}\1\1")
            imap.select(self._mailbox)
            criteria = "UNSEEN"
            typ, data = imap.search(None, criteria)
            if typ != "OK":
                return []
            for num in (data[0] or b"").split():
                typ, msg_data = imap.fetch(num, "(RFC822)")
                if typ != "OK" or not msg_data:
                    continue
                raw = msg_data[0][1]
                msg = BytesParser().parsebytes(raw)
                sender = (msg.get("From") or "").strip()
                subject = (msg.get("Subject") or "").strip()
                decoded = decode_header(subject)
                if decoded and isinstance(decoded[0][0], bytes):
                    subject = decoded[0][0].decode(decoded[0][1] or "utf-8", errors="ignore")
                body = ""
                payload = msg.get_payload(decode=True)
                if isinstance(payload, bytes):
                    body = payload.decode("utf-8", errors="ignore")
                received_at = datetime.now(timezone.utc)
                if since is not None and received_at <= since:
                    continue
                messages.append(
                    IncomingMessage(
                        source="email",
                        external_id=None,
                        sender=sender,
                        subject=subject,
                        body=body,
                        received_at=received_at,
                    )
                )
        return messages

