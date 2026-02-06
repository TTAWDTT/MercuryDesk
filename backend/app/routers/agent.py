from __future__ import annotations

from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud
from app.db import get_session
from app.models import User
from app.routers.auth import get_current_user
from app.schemas import (
    AgentConfigOut,
    AgentConfigUpdate,
    AgentSummarizeRequest,
    AgentSummarizeResponse,
    AgentTestResponse,
    DraftReplyRequest,
    DraftReplyResponse,
    ModelCatalogResponse,
)
from app.services.encryption import decrypt_optional
from app.services.model_catalog import get_model_catalog
from app.services.summarizer import RuleBasedSummarizer

router = APIRouter(prefix="/agent", tags=["agent"])

_summarizer = RuleBasedSummarizer()


def _default_config() -> AgentConfigOut:
    return AgentConfigOut(
        provider="rule_based",
        base_url="https://api.openai.com/v1",
        model="gpt-4o-mini",
        temperature=0.2,
        has_api_key=False,
    )


def _config_out(db: Session, user_id: int) -> AgentConfigOut:
    config = crud.get_agent_config(db, user_id=user_id)
    if config is None:
        return _default_config()

    api_key = decrypt_optional(config.api_key)
    return AgentConfigOut(
        provider=(config.provider or "rule_based").lower(),
        base_url=config.base_url or "https://api.openai.com/v1",
        model=config.model or "gpt-4o-mini",
        temperature=float(config.temperature or 0.2),
        has_api_key=bool(api_key),
    )


def _openai_chat(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int = 256,
) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    with httpx.Client(timeout=30) as client:
        resp = client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            detail = resp.text
            try:
                data = resp.json()
                if isinstance(data, dict):
                    err = data.get("error") or {}
                    msg = err.get("message")
                    if isinstance(msg, str) and msg.strip():
                        detail = msg.strip()
            except Exception:
                pass
            raise ValueError(detail or f"HTTP {resp.status_code}")
        data = resp.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except Exception as e:
        raise ValueError(f"Unexpected agent response: {e}") from e
    if not isinstance(content, str):
        raise ValueError("Unexpected agent response: content is not a string")
    return content.strip()


def _provider_for(config: AgentConfigOut) -> Literal["rule_based", "openai"]:
    p = (config.provider or "rule_based").lower().strip()
    if p in {"rule_based", "rule-based", "builtin", "local"}:
        return "rule_based"
    return "openai"


@router.get("/catalog", response_model=ModelCatalogResponse)
def model_catalog(force_refresh: bool = Query(default=False)):
    return get_model_catalog(force_refresh=force_refresh)


@router.post("/summarize", response_model=AgentSummarizeResponse)
def summarize(
    payload: AgentSummarizeRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    config = _config_out(db, current_user.id)
    provider = _provider_for(config)
    if provider == "rule_based":
        return AgentSummarizeResponse(summary=_summarizer.summarize(payload.text))

    stored = crud.get_agent_config(db, user_id=current_user.id)
    api_key = decrypt_optional(stored.api_key if stored else None) if stored else None
    if not api_key:
        raise HTTPException(status_code=400, detail="请先在设置里配置 Agent API Key")
    if not (config.base_url or "").strip():
        raise HTTPException(status_code=400, detail="请先在设置里配置 Agent Base URL")

    try:
        summary = _openai_chat(
            base_url=config.base_url,
            api_key=api_key,
            model=config.model,
            temperature=float(config.temperature),
            max_tokens=220,
            messages=[
                {
                    "role": "system",
                    "content": "你是 MercuryDesk 的邮件助手。请用简体中文在 120 字以内总结用户提供的内容，保留关键信息，避免冗余。",
                },
                {"role": "user", "content": payload.text},
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AgentSummarizeResponse(summary=summary)


@router.post("/draft-reply", response_model=DraftReplyResponse)
def draft_reply(
    payload: DraftReplyRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    config = _config_out(db, current_user.id)
    provider = _provider_for(config)
    if provider == "rule_based":
        return DraftReplyResponse(draft=_summarizer.draft_reply(payload.text, tone=payload.tone))

    stored = crud.get_agent_config(db, user_id=current_user.id)
    api_key = decrypt_optional(stored.api_key if stored else None) if stored else None
    if not api_key:
        raise HTTPException(status_code=400, detail="请先在设置里配置 Agent API Key")
    if not (config.base_url or "").strip():
        raise HTTPException(status_code=400, detail="请先在设置里配置 Agent Base URL")

    tone = (payload.tone or "friendly").lower().strip()
    tone_zh = "友好" if tone in {"friendly", "casual"} else "正式"

    try:
        draft = _openai_chat(
            base_url=config.base_url,
            api_key=api_key,
            model=config.model,
            temperature=float(config.temperature),
            max_tokens=360,
            messages=[
                {
                    "role": "system",
                    "content": f"你是 MercuryDesk 的邮件助手。请用简体中文生成一封“{tone_zh}”语气的回复草稿，简洁清晰，可直接发送。",
                },
                {"role": "user", "content": payload.text},
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return DraftReplyResponse(draft=draft)


@router.get("/config", response_model=AgentConfigOut)
def get_agent_config(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _config_out(db, current_user.id)


@router.patch("/config", response_model=AgentConfigOut)
def update_agent_config(
    payload: AgentConfigUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    provider = payload.provider.lower().strip() if payload.provider is not None else None
    config = crud.upsert_agent_config(
        db,
        user_id=current_user.id,
        provider=provider,
        base_url=payload.base_url,
        model=payload.model,
        temperature=payload.temperature,
        api_key=payload.api_key,
    )
    api_key = decrypt_optional(config.api_key)
    return AgentConfigOut(
        provider=config.provider,
        base_url=config.base_url,
        model=config.model,
        temperature=float(config.temperature),
        has_api_key=bool(api_key),
    )


@router.post("/test", response_model=AgentTestResponse)
def test_agent(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    config = _config_out(db, current_user.id)
    provider = _provider_for(config)
    if provider == "rule_based":
        return AgentTestResponse(ok=True, provider="rule_based", message="内置规则引擎已就绪")

    stored = crud.get_agent_config(db, user_id=current_user.id)
    api_key = decrypt_optional(stored.api_key if stored else None) if stored else None
    if not api_key:
        raise HTTPException(status_code=400, detail="缺少 API Key")
    if not (config.base_url or "").strip():
        raise HTTPException(status_code=400, detail="缺少 Base URL")

    try:
        out = _openai_chat(
            base_url=config.base_url,
            api_key=api_key,
            model=config.model,
            temperature=float(config.temperature),
            max_tokens=30,
            messages=[
                {"role": "system", "content": "你是一个健康检查器。只回复 OK。"},
                {"role": "user", "content": "ping"},
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return AgentTestResponse(ok=True, provider=config.provider, message=out or "OK")
