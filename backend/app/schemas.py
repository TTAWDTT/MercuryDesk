from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    avatar_url: Optional[str] = None
    created_at: datetime


class ConnectedAccountCreate(BaseModel):
    provider: str = Field(min_length=2, max_length=50)
    identifier: str = Field(min_length=1, max_length=255)
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

    # Optional provider-specific fields (used when provider == "imap").
    imap_host: Optional[str] = Field(None, min_length=1, max_length=255)
    imap_port: Optional[int] = Field(None, ge=1, le=65535)
    imap_use_ssl: Optional[bool] = None
    imap_username: Optional[str] = Field(None, min_length=1, max_length=255)
    imap_password: Optional[str] = Field(None, min_length=1, max_length=2048)
    imap_mailbox: Optional[str] = Field(None, min_length=1, max_length=255)


class ConnectedAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    identifier: str
    last_synced_at: Optional[datetime] = None
    created_at: datetime


class ContactOut(BaseModel):
    id: int
    display_name: str
    handle: str
    avatar_url: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    latest_subject: Optional[str] = None
    latest_preview: Optional[str] = None
    latest_source: Optional[str] = None
    latest_received_at: Optional[datetime] = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contact_id: int
    source: str
    sender: str
    subject: str
    body_preview: str
    received_at: datetime
    is_read: bool
    summary: Optional[str] = None


class MessageDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contact_id: int
    source: str
    sender: str
    subject: str
    body: str
    received_at: datetime
    is_read: bool
    summary: Optional[str] = None


class AgentSummarizeRequest(BaseModel):
    text: str


class AgentSummarizeResponse(BaseModel):
    summary: str


class DraftReplyRequest(BaseModel):
    text: str
    tone: str = "friendly"


class DraftReplyResponse(BaseModel):
    draft: str


class AgentConfigOut(BaseModel):
    provider: str
    base_url: str
    model: str
    temperature: float
    has_api_key: bool = False


class AgentConfigUpdate(BaseModel):
    provider: Optional[str] = None
    base_url: Optional[str] = Field(None, min_length=1, max_length=2048)
    model: Optional[str] = Field(None, min_length=1, max_length=255)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    api_key: Optional[str] = Field(None, min_length=1, max_length=4096)


class AgentTestResponse(BaseModel):
    ok: bool
    provider: str
    message: str
