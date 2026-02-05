from __future__ import annotations

from fastapi import APIRouter

from app.schemas import AgentSummarizeRequest, AgentSummarizeResponse, DraftReplyRequest, DraftReplyResponse
from app.services.summarizer import RuleBasedSummarizer

router = APIRouter(prefix="/agent", tags=["agent"])

_summarizer = RuleBasedSummarizer()


@router.post("/summarize", response_model=AgentSummarizeResponse)
def summarize(payload: AgentSummarizeRequest):
    return AgentSummarizeResponse(summary=_summarizer.summarize(payload.text))


@router.post("/draft-reply", response_model=DraftReplyResponse)
def draft_reply(payload: DraftReplyRequest):
    return DraftReplyResponse(draft=_summarizer.draft_reply(payload.text, tone=payload.tone))

