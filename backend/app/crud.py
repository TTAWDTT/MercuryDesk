from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models import ConnectedAccount, Contact, Message, User
from app.security import get_password_hash, verify_password
from app.services.encryption import decrypt_optional, encrypt_optional


def create_user(db: Session, *, email: str, password: str) -> User:
    user = User(email=email, hashed_password=get_password_hash(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_connected_account(
    db: Session, *, user_id: int, provider: str, identifier: str, access_token: str | None, refresh_token: str | None
) -> ConnectedAccount:
    account = ConnectedAccount(
        user_id=user_id,
        provider=provider,
        identifier=identifier,
        access_token=encrypt_optional(access_token),
        refresh_token=encrypt_optional(refresh_token),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def list_accounts(db: Session, *, user_id: int) -> list[ConnectedAccount]:
    return list(db.scalars(select(ConnectedAccount).where(ConnectedAccount.user_id == user_id).order_by(ConnectedAccount.id)))


def get_account(db: Session, *, user_id: int, account_id: int) -> ConnectedAccount | None:
    return db.scalar(
        select(ConnectedAccount).where(ConnectedAccount.user_id == user_id, ConnectedAccount.id == account_id)
    )


def upsert_contact(db: Session, *, user_id: int, handle: str, display_name: str) -> Contact:
    existing = db.scalar(select(Contact).where(Contact.user_id == user_id, Contact.handle == handle))
    if existing is not None:
        if display_name and existing.display_name != display_name:
            existing.display_name = display_name
        return existing
    contact = Contact(user_id=user_id, handle=handle, display_name=display_name or handle)
    db.add(contact)
    db.flush()
    return contact


def create_message(
    db: Session,
    *,
    user_id: int,
    contact_id: int,
    source: str,
    external_id: str | None,
    sender: str,
    subject: str,
    body: str,
    received_at: datetime,
    summary: str | None,
) -> Message | None:
    if external_id is not None:
        existing = db.scalar(
            select(Message).where(Message.user_id == user_id, Message.source == source, Message.external_id == external_id)
        )
        if existing is not None:
            return None
    preview = (body or "").strip().replace("\r\n", "\n").replace("\n", " ")
    preview = preview[:5000]
    msg = Message(
        user_id=user_id,
        contact_id=contact_id,
        source=source,
        external_id=external_id,
        sender=sender,
        subject=subject or "",
        body=body or "",
        body_preview=preview,
        received_at=received_at,
        summary=summary,
        is_read=False,
    )
    db.add(msg)
    return msg


def contact_unread_count(db: Session, *, user_id: int, contact_id: int) -> int:
    return int(
        db.scalar(
            select(func.count(Message.id)).where(
                Message.user_id == user_id, Message.contact_id == contact_id, Message.is_read.is_(False)
            )
        )
        or 0
    )


def list_contacts(db: Session, *, user_id: int) -> list[tuple[Contact, int]]:
    contacts = list(
        db.scalars(
            select(Contact)
            .where(Contact.user_id == user_id)
            .order_by(Contact.last_message_at.desc().nullslast(), Contact.id.desc())
        )
    )
    return [(c, contact_unread_count(db, user_id=user_id, contact_id=c.id)) for c in contacts]


def list_messages(db: Session, *, user_id: int, contact_id: int, limit: int = 50) -> list[Message]:
    return list(
        db.scalars(
            select(Message)
            .where(Message.user_id == user_id, Message.contact_id == contact_id)
            .order_by(Message.received_at.desc(), Message.id.desc())
            .limit(limit)
        )
    )


def get_message(db: Session, *, user_id: int, message_id: int) -> Message | None:
    return db.scalar(select(Message).where(Message.user_id == user_id, Message.id == message_id))


def mark_contact_read(db: Session, *, user_id: int, contact_id: int) -> int:
    messages = list(
        db.scalars(
            select(Message).where(Message.user_id == user_id, Message.contact_id == contact_id, Message.is_read.is_(False))
        )
    )
    for m in messages:
        m.is_read = True
    return len(messages)


def decrypt_account_tokens(account: ConnectedAccount) -> tuple[str | None, str | None]:
    return decrypt_optional(account.access_token), decrypt_optional(account.refresh_token)


def touch_contact_last_message(db: Session, *, contact: Contact, received_at: datetime) -> None:
    if contact.last_message_at is None or received_at > contact.last_message_at:
        contact.last_message_at = received_at


def touch_account_sync(db: Session, *, account: ConnectedAccount) -> None:
    account.last_synced_at = datetime.now(timezone.utc)

