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
    sender_avatar_url: Optional[str] = None
    title: str
    received_at: str
    score: float


class AelinChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1200)
    use_memory: bool = True
    max_citations: int = Field(default=6, ge=1, le=20)
    workspace: str = Field(default="default", min_length=1, max_length=64)
    images: list["AelinImageInput"] = Field(default_factory=list, max_length=4)
    history: list["AelinChatHistoryTurn"] = Field(default_factory=list, max_length=20)
    search_mode: str = Field(default="auto", min_length=1, max_length=16)


class AelinChatHistoryTurn(BaseModel):
    role: str = Field(min_length=1, max_length=16)
    content: str = Field(min_length=1, max_length=3000)


class AelinImageInput(BaseModel):
    data_url: str = Field(min_length=20, max_length=3_000_000)
    name: str = Field(default="", max_length=120)


class AelinCitation(BaseModel):
    message_id: int
    source: str
    source_label: str
    sender: str
    sender_avatar_url: Optional[str] = None
    title: str
    received_at: str
    score: float


class AelinAction(BaseModel):
    kind: str
    title: str
    detail: str = ""
    payload: dict[str, str] = Field(default_factory=dict)


class AelinToolStep(BaseModel):
    stage: str
    status: str = "completed"
    detail: str = ""
    count: int = 0
    ts: int = 0


class AelinTodoItem(BaseModel):
    id: int
    title: str
    detail: str = ""
    done: bool = False
    due_at: Optional[str] = None
    priority: str = "normal"
    contact_id: Optional[int] = None
    message_id: Optional[int] = None
    updated_at: str


class AelinPinRecommendationItem(BaseModel):
    contact_id: int
    display_name: str
    score: float
    reasons: list[str] = Field(default_factory=list)
    unread_count: int = 0
    last_message_at: Optional[datetime] = None


class AelinDailyBriefAction(BaseModel):
    kind: str
    title: str
    detail: str = ""
    contact_id: Optional[int] = None
    message_id: Optional[int] = None
    priority: str = "normal"


class AelinDailyBrief(BaseModel):
    generated_at: datetime
    summary: str
    top_updates: list[AgentFocusItemOut] = Field(default_factory=list)
    actions: list[AelinDailyBriefAction] = Field(default_factory=list)


class AelinLayoutCard(BaseModel):
    contact_id: int
    display_name: str
    pinned: bool = False
    order: int = Field(default=0, ge=0)
    x: float = Field(default=0, ge=0)
    y: float = Field(default=0, ge=0)
    width: float = Field(default=312, ge=120, le=2400)
    height: float = Field(default=316, ge=120, le=2400)


class AelinMemoryLayerItem(BaseModel):
    id: str
    layer: str
    title: str
    detail: str = ""
    source: str = ""
    confidence: float = 0.5
    updated_at: str = ""
    meta: dict[str, str] = Field(default_factory=dict)


class AelinMemoryLayers(BaseModel):
    facts: list[AelinMemoryLayerItem] = Field(default_factory=list)
    preferences: list[AelinMemoryLayerItem] = Field(default_factory=list)
    in_progress: list[AelinMemoryLayerItem] = Field(default_factory=list)
    generated_at: datetime


class AelinNotificationItem(BaseModel):
    id: str
    level: str = "info"
    title: str
    detail: str = ""
    source: str = ""
    ts: str = ""
    action_kind: Optional[str] = None
    action_payload: dict[str, str] = Field(default_factory=dict)


class AelinNotificationResponse(BaseModel):
    total: int = 0
    items: list[AelinNotificationItem] = Field(default_factory=list)
    generated_at: datetime


class AgentMemorySnapshot(BaseModel):
    summary: str = ""
    notes: list[AgentMemoryNoteOut] = Field(default_factory=list)
    focus_items: list[AgentFocusItemOut] = Field(default_factory=list)


class AelinContextResponse(BaseModel):
    workspace: str = "default"
    summary: str = ""
    focus_items: list[AgentFocusItemOut] = Field(default_factory=list)
    notes: list[AgentMemoryNoteOut] = Field(default_factory=list)
    notes_count: int = 0
    todos: list[AelinTodoItem] = Field(default_factory=list)
    pin_recommendations: list[AelinPinRecommendationItem] = Field(default_factory=list)
    daily_brief: Optional[AelinDailyBrief] = None
    layout_cards: list[AelinLayoutCard] = Field(default_factory=list)
    memory_layers: AelinMemoryLayers
    notifications: list[AelinNotificationItem] = Field(default_factory=list)
    generated_at: datetime


class AelinChatResponse(BaseModel):
    answer: str
    expression: str = "exp-04"
    citations: list[AelinCitation] = Field(default_factory=list)
    actions: list[AelinAction] = Field(default_factory=list)
    tool_trace: list[AelinToolStep] = Field(default_factory=list)
    memory_summary: str = ""
    generated_at: datetime


class AelinTrackConfirmRequest(BaseModel):
    target: str = Field(min_length=1, max_length=240)
    source: str = Field(default="auto", min_length=1, max_length=32)
    query: str = Field(default="", max_length=500)


class AelinTrackConfirmResponse(BaseModel):
    status: str
    message: str
    provider: Optional[str] = None
    actions: list[AelinAction] = Field(default_factory=list)
    generated_at: datetime


class AelinTrackingItem(BaseModel):
    note_id: Optional[int] = None
    message_id: Optional[int] = None
    target: str
    source: str
    query: str = ""
    status: str = "active"
    updated_at: str
    status_updated_at: Optional[str] = None


class AelinTrackingListResponse(BaseModel):
    total: int
    items: list[AelinTrackingItem] = Field(default_factory=list)
    generated_at: datetime


class AgentCardLayoutItem(BaseModel):
    contact_id: int
    display_name: str = Field(min_length=1, max_length=255)
    pinned: bool = False
    order: int = Field(default=0, ge=0)
    x: float = Field(default=0, ge=0)
    y: float = Field(default=0, ge=0)
    width: float = Field(default=312, ge=120, le=2400)
    height: float = Field(default=316, ge=120, le=2400)


class AgentCardLayoutUpdate(BaseModel):
    cards: list[AgentCardLayoutItem] = Field(default_factory=list)
    workspace: str = Field(default="default", min_length=1, max_length=64)


class AgentPinRecommendationItem(BaseModel):
    contact_id: int
    display_name: str
    score: float
    reasons: list[str] = Field(default_factory=list)
    unread_count: int = 0
    last_message_at: Optional[datetime] = None


class AgentPinRecommendationResponse(BaseModel):
    generated_at: datetime
    items: list[AgentPinRecommendationItem] = Field(default_factory=list)


class AgentTodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    detail: str = Field(default="", max_length=2000)
    due_at: Optional[str] = None
    priority: str = Field(default="normal", min_length=1, max_length=16)
    contact_id: Optional[int] = None
    message_id: Optional[int] = None


class AgentTodoUpdate(BaseModel):
    done: Optional[bool] = None
    title: Optional[str] = Field(None, min_length=1, max_length=240)
    detail: Optional[str] = Field(None, max_length=2000)
    due_at: Optional[str] = None
    priority: Optional[str] = Field(None, min_length=1, max_length=16)


class AgentTodoOut(BaseModel):
    id: int
    title: str
    detail: str = ""
    done: bool = False
    due_at: Optional[str] = None
    priority: str = "normal"
    contact_id: Optional[int] = None
    message_id: Optional[int] = None
    updated_at: str


class AgentDailyBriefAction(BaseModel):
    kind: str
    title: str
    detail: str = ""
    contact_id: Optional[int] = None
    message_id: Optional[int] = None
    priority: str = "normal"


class AgentDailyBriefResponse(BaseModel):
    generated_at: datetime
    summary: str
    top_updates: list[AgentFocusItemOut] = Field(default_factory=list)
    actions: list[AgentDailyBriefAction] = Field(default_factory=list)


class AgentAdvancedSearchRequest(BaseModel):
    query: str = Field(default="", max_length=200)
    source: Optional[str] = Field(default=None, max_length=50)
    unread_only: bool = False
    days: int = Field(default=30, ge=1, le=365)
    limit: int = Field(default=20, ge=1, le=100)


class AgentAdvancedSearchItem(BaseModel):
    message_id: int
    contact_id: int
    sender: str
    subject: str
    source: str
    received_at: str
    preview: str
    is_read: bool
    score: float
    reason: str = ""


class AgentAdvancedSearchResponse(BaseModel):
    total: int
    items: list[AgentAdvancedSearchItem] = Field(default_factory=list)


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
