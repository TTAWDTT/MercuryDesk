from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.connectors.github import GitHubNotificationsConnector
from app.connectors.mock import MockConnector
from app.crud import (
    create_message,
    decrypt_account_tokens,
    touch_account_sync,
    touch_contact_last_message,
)
from app.models import ConnectedAccount, Contact, Message
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

    incoming_messages = connector.fetch_new_messages(since=since)
    if not incoming_messages:
        touch_account_sync(db, account=account)
        db.commit()
        return 0

    handles = {m.sender for m in incoming_messages}
    existing_contacts = list(
        db.scalars(select(Contact).where(Contact.user_id == account.user_id, Contact.handle.in_(handles)))
    )
    contacts_by_handle: dict[str, Contact] = {c.handle: c for c in existing_contacts}

    for handle in handles - set(contacts_by_handle):
        contact = Contact(user_id=account.user_id, handle=handle, display_name=handle)
        db.add(contact)
        contacts_by_handle[handle] = contact
    db.flush()

    # Deduplicate by external_id in bulk (per source) to avoid per-message queries.
    external_ids_by_source: dict[str, list[str]] = defaultdict(list)
    for m in incoming_messages:
        if m.external_id:
            external_ids_by_source[m.source].append(m.external_id)

    existing_external_ids: dict[str, set[str]] = {}
    for source, ids in external_ids_by_source.items():
        if not ids:
            existing_external_ids[source] = set()
            continue
        existing_external_ids[source] = set(
            db.scalars(
                select(Message.external_id).where(
                    Message.user_id == account.user_id,
                    Message.source == source,
                    Message.external_id.in_(ids),
                )
            )
        )

    inserted = 0
    for incoming in incoming_messages:
        if incoming.external_id and incoming.external_id in existing_external_ids.get(incoming.source, set()):
            continue

        contact = contacts_by_handle[incoming.sender]
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
            skip_external_id_check=True,
        )
        if msg is None:
            continue
        inserted += 1
        touch_contact_last_message(db, contact=contact, received_at=incoming.received_at)

    touch_account_sync(db, account=account)
    db.commit()
    return inserted
