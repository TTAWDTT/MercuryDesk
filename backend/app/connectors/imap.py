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

    def _is_auth_error(self, error: Exception) -> bool:
        message = str(error).lower()
        markers = (
            "authenticationfailed",
            "invalid credentials",
            "auth failed",
            "authentification",
            "login failed",
            "application-specific password",
            "app password",
            "web login required",
        )
        return any(marker in message for marker in markers)

    def _humanize_error(self, error: Exception) -> str:
        raw = str(error).strip()
        message = raw.lower()
        if any(
            marker in message
            for marker in (
                "authenticationfailed",
                "invalid credentials",
                "auth failed",
                "authentification",
                "login failed",
            )
        ):
            return (
                "账号或授权码错误。请确认已开启 IMAP，并使用应用专用密码/授权码"
                "（不是邮箱网页登录密码）。"
            )
        if "application-specific password" in message or "app password" in message:
            return "服务商要求应用专用密码，请在邮箱安全设置中生成后重试。"
        if "web login required" in message or "please log in via your web browser" in message:
            return "需要先在邮箱网页端完成一次安全验证，再使用应用专用密码重试。"
        if any(marker in message for marker in ("ssl", "tls", "certificate")):
            return "SSL/TLS 连接失败，请检查 IMAP 主机、端口和 SSL 开关。"
        if any(
            marker in message
            for marker in (
                "timed out",
                "timeout",
                "connection refused",
                "name or service not known",
                "getaddrinfo failed",
            )
        ):
            return "无法连接到 IMAP 服务器，请检查主机、端口和网络。"
        return raw or "未知错误"

    def _candidate_passwords(self) -> list[str]:
        raw = self._password
        compact = re.sub(r"\s+", "", raw)
        candidates = [raw]
        if compact and compact != raw:
            candidates.insert(0, compact)
        return list(dict.fromkeys(candidates))

    def _fetch_with_password(
        self,
        *,
        password: str,
        since_utc: datetime | None,
        date_criteria: str | None,
    ) -> list[IncomingMessage]:
        messages: list[IncomingMessage] = []
        client_factory = IMAP4_SSL if self._use_ssl else IMAP4
        with client_factory(self._host, self._port) as imap:
            imap.login(self._username, password)
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
        return messages

    def fetch_new_messages(self, *, since: datetime | None) -> list[IncomingMessage]:
        since_utc = since.astimezone(timezone.utc) if since else None
        date_criteria = since_utc.strftime("%d-%b-%Y") if since_utc else None
        candidates = self._candidate_passwords()
        errors: list[Exception] = []
        for index, candidate in enumerate(candidates):
            try:
                return self._fetch_with_password(password=candidate, since_utc=since_utc, date_criteria=date_criteria)
            except Exception as error:
                errors.append(error)
                if index < len(candidates) - 1 and self._is_auth_error(error):
                    continue
                break

        last_error = errors[-1] if errors else ValueError("unknown imap error")
        raise ValueError(f"IMAP sync failed: {self._humanize_error(last_error)}") from last_error
