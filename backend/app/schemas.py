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
    provider: str = Field(min_length=1, max_length=50)
    identifier: str = Field(default="", max_length=255)
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

    # Optional provider-specific fields (used when provider == "imap").
    imap_host: Optional[str] = Field(None, min_length=1, max_length=255)
    imap_port: Optional[int] = Field(None, ge=1, le=65535)
    imap_use_ssl: Optional[bool] = None
    imap_username: Optional[str] = Field(None, min_length=1, max_length=255)
    imap_password: Optional[str] = Field(None, min_length=1, max_length=2048)
    imap_mailbox: Optional[str] = Field(None, min_length=1, max_length=255)

    # Optional provider-specific fields (used when provider in {"rss", "bilibili", "x"}).
    feed_url: Optional[str] = Field(None, max_length=2048)
    feed_homepage_url: Optional[str] = Field(None, max_length=2048)
    feed_display_name: Optional[str] = Field(None, max_length=255)
    bilibili_uid: Optional[str] = Field(None, min_length=1, max_length=64)
    x_username: Optional[str] = Field(None, min_length=1, max_length=64)
    forward_display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    forward_source_email: Optional[EmailStr] = None


class ConnectedAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    identifier: str
    last_synced_at: Optional[datetime] = None
    created_at: datetime


class AccountOAuthStartResponse(BaseModel):
    provider: str
    auth_url: str


class OAuthCredentialConfigOut(BaseModel):
    provider: str
    configured: bool
    client_id_hint: Optional[str] = None


class OAuthCredentialConfigUpdate(BaseModel):
    client_id: str = Field(min_length=1, max_length=512)
    client_secret: str = Field(min_length=1, max_length=4096)


class ForwardAccountInfo(BaseModel):
    account_id: int
    provider: str
    identifier: str
    source_email: EmailStr
    forward_address: str
    inbound_url: str


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


class AgentChatRequest(BaseModel):
    messages: list[dict[str, str]]
    context_contact_id: Optional[int] = None
    tools: list[str] = Field(default_factory=list)
    use_memory: bool = True
    stream: bool = True


class AgentMemoryNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    kind: str = Field(default="note", min_length=1, max_length=32)


class AgentMemoryNoteOut(BaseModel):
    id: int
    kind: str
    content: str
    source: Optional[str] = None
    updated_at: str


class AgentFocusItemOut(BaseModel):
    message_id: int
    source: str
    source_label: str
    sender: str
    title: str
    received_at: str
    score: float


class AgentMemorySnapshot(BaseModel):
    summary: str = ""
    notes: list[AgentMemoryNoteOut] = Field(default_factory=list)
    focus_items: list[AgentFocusItemOut] = Field(default_factory=list)


class AgentCardLayoutItem(BaseModel):
    contact_id: int
    display_name: str = Field(min_length=1, max_length=255)
    pinned: bool = False
    scale: float = Field(default=1.0, ge=0.8, le=1.5)
    order: int = Field(default=0, ge=0)


class AgentCardLayoutUpdate(BaseModel):
    cards: list[AgentCardLayoutItem] = Field(default_factory=list)


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


class ModelInfo(BaseModel):
    id: str
    name: str
    family: Optional[str] = None
    reasoning: Optional[bool] = None
    tool_call: Optional[bool] = None
    temperature: Optional[bool] = None


class ModelProviderInfo(BaseModel):
    id: str
    name: str
    api: Optional[str] = None
    doc: Optional[str] = None
    env: list[str] = Field(default_factory=list)
    model_count: int = 0
    models: list[ModelInfo] = Field(default_factory=list)


class ModelCatalogResponse(BaseModel):
    source_url: str
    fetched_at: datetime
    providers: list[ModelProviderInfo]


class SyncJobStartResponse(BaseModel):
    job_id: str
    status: str
    account_id: int


class SyncJobStatusResponse(BaseModel):
    job_id: str
    status: str
    account_id: int
    inserted: Optional[int] = None
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
