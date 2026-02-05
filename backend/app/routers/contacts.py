from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db import get_session
from app.models import Contact, User
from app.routers.auth import get_current_user
from app.schemas import ContactOut, MessageOut

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut])
def list_contacts(
    q: str | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    rows = crud.list_contacts(db, user_id=current_user.id, q=q, limit=limit, offset=offset)
    return [
        ContactOut(
            id=contact.id,
            display_name=contact.display_name,
            handle=contact.handle,
            avatar_url=contact.avatar_url,
            last_message_at=contact.last_message_at,
            unread_count=unread,
            latest_subject=latest_subject,
            latest_preview=latest_preview,
            latest_source=latest_source,
            latest_received_at=latest_received_at,
        )
        for contact, unread, latest_subject, latest_preview, latest_source, latest_received_at in rows
    ]


@router.get("/{contact_id}/messages", response_model=list[MessageOut])
def list_contact_messages(
    contact_id: int,
    limit: int = 50,
    before_id: int | None = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    contact = db.get(Contact, contact_id)
    if contact is None or contact.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Contact not found")
    before = None
    if before_id is not None:
        before_msg = crud.get_message(db, user_id=current_user.id, message_id=before_id)
        if before_msg is None or before_msg.contact_id != contact_id:
            raise HTTPException(status_code=400, detail="Invalid before_id")
        before = (before_msg.received_at, before_msg.id)

    msgs = crud.list_messages(db, user_id=current_user.id, contact_id=contact_id, limit=limit, before=before)
    return msgs


@router.post("/{contact_id}/mark-read")
def mark_read(
    contact_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    contact = db.get(Contact, contact_id)
    if contact is None or contact.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Contact not found")
    marked = crud.mark_contact_read(db, user_id=current_user.id, contact_id=contact_id)
    db.commit()
    return {"marked": marked, "contact_id": contact_id}
