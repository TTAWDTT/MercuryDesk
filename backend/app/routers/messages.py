from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db import get_session
from app.models import User
from app.routers.auth import get_current_user
from app.schemas import MessageDetail

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/{message_id}", response_model=MessageDetail)
def get_message(
    message_id: int, db: Session = Depends(get_session), current_user: User = Depends(get_current_user)
):
    msg = crud.get_message(db, user_id=current_user.id, message_id=message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg

