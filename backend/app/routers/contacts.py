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
def list_contacts(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    rows = crud.list_contacts(db, user_id=current_user.id)
    return [
        ContactOut(
            id=contact.id,
            display_name=contact.display_name,
            handle=contact.handle,
            avatar_url=contact.avatar_url,
            last_message_at=contact.last_message_at,
            unread_count=unread,
        )
        for contact, unread in rows
    ]


@router.get("/{contact_id}/messages", response_model=list[MessageOut])
def list_contact_messages(
    contact_id: int,
    limit: int = 50,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    contact = db.get(Contact, contact_id)
    if contact is None or contact.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Contact not found")
    msgs = crud.list_messages(db, user_id=current_user.id, contact_id=contact_id, limit=limit)
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

