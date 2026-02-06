from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.connectors.feed import FeedConnector
from app.connectors.gmail import GmailConnector
from app.connectors.github import GitHubNotificationsConnector
from app.connectors.imap import ImapConnector
from app.connectors.mock import MockConnector
from app.connectors.outlook import OutlookConnector
from app.crud import (
    create_message,
    decrypt_account_tokens,
    get_user_oauth_credentials,
    touch_account_sync,
    touch_contact_last_message,
)
from app.models import ConnectedAccount, Contact, FeedAccountConfig, ImapAccountConfig, Message
from app.services.encryption import decrypt_optional, encrypt_optional
from app.services.feed_urls import normalize_feed_url
from app.services.oauth_clients import refresh_access_token
from app.services.summarizer import RuleBasedSummarizer


def _normalize_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _connector_for(db: Session, account: ConnectedAccount):
    access_token, _refresh = decrypt_account_tokens(account)
    provider = account.provider.lower()

    if provider == "mock":
        return MockConnector()
    if provider == "forward":
        class _NoopConnector:
            def fetch_new_messages(self, *, since):
                return []

        return _NoopConnector()
    if provider == "github":
        if not access_token:
            raise ValueError("GitHub account requires access_token")
        return GitHubNotificationsConnector(access_token)
    if provider == "gmail":
        if not access_token:
            raise ValueError("Gmail account requires access_token")
        return GmailConnector(access_token=access_token)
    if provider == "outlook":
        if not access_token:
            raise ValueError("Outlook account requires access_token")
        return OutlookConnector(access_token=access_token)
    if provider == "imap":
        config = db.get(ImapAccountConfig, account.id)
        if config is None:
            raise ValueError("IMAP account requires configuration")

        password = decrypt_optional(config.password)
        if not password:
            raise ValueError("IMAP account requires password")

        return ImapConnector(
            host=config.host,
            port=int(config.port),
            use_ssl=bool(config.use_ssl),
            username=config.username,
            password=password,
            mailbox=config.mailbox or "INBOX",
            external_id_prefix=f"imap:{account.id}",
        )
    if provider in {"rss", "bilibili", "x"}:
        config = db.get(FeedAccountConfig, account.id)
        if config is None or not config.feed_url:
            raise ValueError(f"{provider} account requires feed configuration")
        normalized_feed_url = normalize_feed_url(config.feed_url)
        if normalized_feed_url != config.feed_url:
            config.feed_url = normalized_feed_url
            if provider == "rss" and (config.homepage_url or "").strip() in {"", "https://www.anthropic.com/news"}:
                config.homepage_url = "https://claude.com/blog/"
            db.add(config)
            db.flush()
        return FeedConnector(
            feed_url=normalized_feed_url,
            source=provider,
            default_sender=(config.display_name or account.identifier or provider),
        )
    raise ValueError(f"Unknown provider: {account.provider}")


def _try_refresh_oauth_token(db: Session, *, account: ConnectedAccount) -> bool:
    provider = account.provider.lower().strip()
    if provider not in {"gmail", "outlook"}:
        return False
    _access_token, refresh_token = decrypt_account_tokens(account)
    if not refresh_token:
        return False
    credentials = get_user_oauth_credentials(
        db,
        user_id=account.user_id,
        provider=provider,
    )
    client_id, client_secret = credentials if credentials else (None, None)
    try:
        next_access, next_refresh = refresh_access_token(
            provider=provider,
            refresh_token=refresh_token,
            client_id=client_id,
            client_secret=client_secret,
        )
    except Exception:
        return False
    account.access_token = encrypt_optional(next_access)
    if next_refresh:
        account.refresh_token = encrypt_optional(next_refresh)
    db.add(account)
    db.flush()
    return True


def sync_account(db: Session, *, account: ConnectedAccount) -> int:
    connector = _connector_for(db, account)
    summarizer = RuleBasedSummarizer()
    since = _normalize_utc(account.last_synced_at)

    try:
        incoming_messages = connector.fetch_new_messages(since=since)
    except ValueError as error:
        if _try_refresh_oauth_token(db, account=account):
            connector = _connector_for(db, account)
            incoming_messages = connector.fetch_new_messages(since=since)
        else:
            raise error
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

        received_at = _normalize_utc(incoming.received_at) or datetime.now(timezone.utc)
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
            received_at=received_at,
            summary=summary,
            skip_external_id_check=True,
        )
        if msg is None:
            continue
        inserted += 1
        touch_contact_last_message(db, contact=contact, received_at=received_at)

    touch_account_sync(db, account=account)
    db.commit()
    return inserted
