from __future__ import annotations

from sqlalchemy.orm import Session

from app.connectors.github import GitHubNotificationsConnector
from app.connectors.imap import ImapConnector
from app.connectors.mock import MockConnector
from app.crud import (
    create_message,
    decrypt_account_tokens,
    touch_account_sync,
    touch_contact_last_message,
    upsert_contact,
)
from app.models import ConnectedAccount
from app.services.summarizer import RuleBasedSummarizer


def _connector_for(account: ConnectedAccount):
    access_token, _refresh = decrypt_account_tokens(account)
    provider = account.provider.lower()

    if provider == "mock":
        return MockConnector()
    if provider == "github":
        if not access_token:
            raise ValueError("GitHub account requires access_token")
        return GitHubNotificationsConnector(access_token)
    if provider == "imap":
        raise ValueError("IMAP connector requires host/username configuration (not yet wired to ConnectedAccount)")
    raise ValueError(f"Unknown provider: {account.provider}")


def sync_account(db: Session, *, account: ConnectedAccount) -> int:
    connector = _connector_for(account)
    summarizer = RuleBasedSummarizer()
    since = account.last_synced_at

    inserted = 0
    for incoming in connector.fetch_new_messages(since=since):
        contact = upsert_contact(db, user_id=account.user_id, handle=incoming.sender, display_name=incoming.sender)
        summary = summarizer.summarize(incoming.body)
        msg = create_message(
            db,
            user_id=account.user_id,
            contact_id=contact.id,
            source=incoming.source,
            external_id=incoming.external_id,
            sender=incoming.sender,
            subject=incoming.subject,
            body=incoming.body,
            received_at=incoming.received_at,
            summary=summary,
        )
        if msg is None:
            continue
        inserted += 1
        touch_contact_last_message(db, contact=contact, received_at=incoming.received_at)

    touch_account_sync(db, account=account)
    db.commit()
    return inserted

