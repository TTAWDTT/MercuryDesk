from __future__ import annotations

from email.message import EmailMessage

from app.connectors.imap import ImapConnector


def test_imap_connector_ignores_logout_socket_eof(monkeypatch):
    msg = EmailMessage()
    msg["From"] = "Demo <demo@example.com>"
    msg["Subject"] = "Test subject"
    msg["Date"] = "Thu, 05 Feb 2026 10:00:00 +0000"
    msg.set_content("Body text")
    raw = msg.as_bytes()

    class FakeImap:
        def __init__(self, host: str, port: int):
            self.host = host
            self.port = port

        def login(self, username: str, password: str):
            return "OK", [b"logged"]

        def select(self, mailbox: str, readonly: bool = True):
            return "OK", [b"1"]

        def uid(self, command: str, *_args):
            if command.lower() == "search":
                return "OK", [b"1001"]
            if command.lower() == "fetch":
                return "OK", [(b"1001 (RFC822)", raw)]
            return "NO", []

        def logout(self):
            raise OSError("socket error: EOF")

    monkeypatch.setattr("app.connectors.imap.IMAP4_SSL", FakeImap)

    connector = ImapConnector(
        host="imap.example.com",
        port=993,
        use_ssl=True,
        username="demo@example.com",
        password="secret",
        mailbox="INBOX",
        external_id_prefix="imap:test",
    )
    messages = connector.fetch_new_messages(since=None)

    assert len(messages) == 1
    assert messages[0].external_id == "imap:test:1001"
    assert messages[0].subject == "Test subject"
