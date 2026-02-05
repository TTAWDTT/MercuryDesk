from __future__ import annotations

import html
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.parser import BytesParser
from email.utils import parseaddr, parsedate_to_datetime
from imaplib import IMAP4, IMAP4_SSL
import re

from app.connectors.base import IncomingMessage


class ImapConnector:
    def __init__(
        self,
        *,
        host: str,
        port: int = 993,
        use_ssl: bool = True,
        username: str,
        password: str,
        mailbox: str = "INBOX",
        external_id_prefix: str = "imap",
        max_messages: int = 200,
    ):
        self._host = host
        self._port = port
        self._use_ssl = use_ssl
        self._username = username
        self._password = password
        self._mailbox = mailbox
        self._external_id_prefix = external_id_prefix
        self._max_messages = max(1, int(max_messages))

    def _decode_header_value(self, value: str) -> str:
        if not value:
            return ""
        try:
            return str(make_header(decode_header(value)))
        except Exception:
            return value

    def _extract_body(self, msg) -> str:
        def decode_part(part) -> str:
            payload = part.get_payload(decode=True)
            if not payload:
                return ""
            charset = part.get_content_charset() or "utf-8"
            try:
                return payload.decode(charset, errors="ignore")
            except LookupError:
                return payload.decode("utf-8", errors="ignore")

        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_maintype() != "text":
                    continue
                if part.get("Content-Disposition", "").lower().startswith("attachment"):
                    continue
                if part.get_content_type() == "text/plain":
                    return decode_part(part).strip()

            for part in msg.walk():
                if part.get_content_maintype() != "text":
                    continue
                if part.get("Content-Disposition", "").lower().startswith("attachment"):
                    continue
                if part.get_content_type() == "text/html":
                    html_body = decode_part(part)
                    html_body = re.sub(r"<[^>]+>", " ", html_body)
                    html_body = html.unescape(html_body)
                    return re.sub(r"[ \t]+", " ", html_body).strip()

            return ""

        body = decode_part(msg)
        return body.strip()

    def _parse_received_at(self, msg) -> datetime:
        date_header = (msg.get("Date") or "").strip()
        if date_header:
            try:
                dt = parsedate_to_datetime(date_header)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except (TypeError, ValueError, OverflowError):
                pass
        return datetime.now(timezone.utc)

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        # Note: Minimal IMAP sync via username/password.
        messages: list[IncomingMessage] = []
        since_utc = since.astimezone(timezone.utc) if since else None
        date_criteria = since_utc.strftime("%d-%b-%Y") if since_utc else None

        client_factory = IMAP4_SSL if self._use_ssl else IMAP4
        try:
            with client_factory(self._host, self._port) as imap:
                imap.login(self._username, self._password)
                typ, _data = imap.select(self._mailbox, readonly=True)
                if typ != "OK":
                    raise ValueError(f"Failed to select mailbox: {self._mailbox}")

                if date_criteria:
                    typ, data = imap.uid("search", None, "SINCE", date_criteria)
                else:
                    typ, data = imap.uid("search", None, "ALL")

                if typ != "OK":
                    return []

                uids = (data[0] or b"").split()
                if not uids:
                    return []

                # Avoid pulling an entire mailbox on the first sync.
                uids = uids[-self._max_messages :]

                for uid in uids:
                    typ, msg_data = imap.uid("fetch", uid, "(RFC822)")
                    if typ != "OK" or not msg_data:
                        continue

                    raw: bytes | None = None
                    for item in msg_data:
                        if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], (bytes, bytearray)):
                            raw = bytes(item[1])
                            break
                    if not raw:
                        continue

                    msg = BytesParser().parsebytes(raw)
                    name, addr = parseaddr((msg.get("From") or "").strip())
                    sender = addr or name or "unknown"
                    subject = self._decode_header_value((msg.get("Subject") or "").strip())
                    body = self._extract_body(msg)
                    received_at = self._parse_received_at(msg)
                    if since_utc is not None and received_at <= since_utc:
                        continue

                    external_id = f"{self._external_id_prefix}:{uid.decode('utf-8', errors='ignore')}"
                    messages.append(
                        IncomingMessage(
                            source="email",
                            external_id=external_id,
                            sender=sender,
                            subject=subject,
                            body=body,
                            received_at=received_at,
                        )
                    )
        except Exception as e:
            raise ValueError(f"IMAP sync failed: {e}") from e
        return messages
