from __future__ import annotations

import json
import hashlib
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.connectors.douyin import _extract_sec_uid as extract_douyin_uid
from app.connectors.xiaohongshu import _extract_user_id as extract_xhs_uid
from app.connectors.weibo import _extract_uid as extract_weibo_uid
from app.db import get_session
from app.models import AgentMemoryNote, Contact, Message, User
from app.routers.auth import get_current_user
from app.schemas import (
    AelinAction,
    AelinChatRequest,
    AelinChatResponse,
    AelinCitation,
    AelinContextResponse,
    AelinDailyBrief,
    AelinDailyBriefAction,
    AelinLayoutCard,
    AelinTrackingItem,
    AelinTrackingListResponse,
    AelinPinRecommendationItem,
    AelinTrackConfirmRequest,
    AelinTrackConfirmResponse,
    AelinToolStep,
    AelinTodoItem,
    AgentConfigOut,
    AgentFocusItemOut,
    AgentMemoryNoteOut,
)
from app.services.agent_memory import AgentMemoryService
from app.services.encryption import decrypt_optional
from app.services.llm import LLMService
from app.services.summarizer import RuleBasedSummarizer
from app.services.sync_jobs import enqueue_sync_job
from app.services.web_search import WebSearchResult, WebSearchService

router = APIRouter(prefix="/aelin", tags=["aelin"])

_memory = AgentMemoryService()
_summarizer = RuleBasedSummarizer()
_web_search = WebSearchService()

_TRACKABLE_SOURCES = {
    "auto",
    "web",
    "rss",
    "x",
    "douyin",
    "xiaohongshu",
    "weibo",
    "bilibili",
    "email",
}

_AELIN_EXPRESSION_IDS = {
    "exp-01",
    "exp-02",
    "exp-03",
    "exp-04",
    "exp-05",
    "exp-06",
    "exp-07",
    "exp-08",
    "exp-09",
    "exp-10",
    "exp-11",
}

_AELIN_EXPRESSION_META: dict[str, dict[str, str]] = {
    "exp-01": {"label": "捂嘴惊喜", "usage": "害羞、惊喜、被夸时的可爱反馈"},
    "exp-02": {"label": "热情出击", "usage": "开场打招呼、推进执行、强积极反馈"},
    "exp-03": {"label": "温柔赞同", "usage": "支持、认可、安抚、温和鼓励"},
    "exp-04": {"label": "托腮思考", "usage": "解释、分析、答疑、默认交流"},
    "exp-05": {"label": "轻声提醒", "usage": "注意事项、风险提示、保守建议"},
    "exp-06": {"label": "偷看观察", "usage": "围观进展、持续关注、等待更多线索"},
    "exp-07": {"label": "低落求助", "usage": "失败、遗憾、道歉、需要帮助"},
    "exp-08": {"label": "不满委屈", "usage": "吐槽、不爽、抗议、情绪性反馈"},
    "exp-09": {"label": "指着大笑", "usage": "玩梗、幽默、轻松调侃"},
    "exp-10": {"label": "发财得意", "usage": "成果突出、搞定任务、高价值收获"},
    "exp-11": {"label": "趴桌躺平", "usage": "困倦、过载、精力不足、需要休息"},
}

_AELIN_EXPRESSION_ALIASES: dict[str, str] = {
    "惊喜": "exp-01",
    "害羞": "exp-01",
    "脸红": "exp-01",
    "开心": "exp-02",
    "兴奋": "exp-02",
    "期待": "exp-02",
    "比心": "exp-03",
    "支持": "exp-03",
    "安抚": "exp-03",
    "默认": "exp-04",
    "友好": "exp-04",
    "疑问": "exp-04",
    "困惑": "exp-04",
    "严肃": "exp-05",
    "警惕": "exp-05",
    "提醒": "exp-05",
    "围观": "exp-06",
    "观察": "exp-06",
    "失败": "exp-07",
    "抱歉": "exp-07",
    "委屈": "exp-08",
    "生气": "exp-08",
    "愤怒": "exp-08",
    "笑": "exp-09",
    "大笑": "exp-09",
    "调皮": "exp-09",
    "眨眼": "exp-09",
    "喜欢": "exp-10",
    "心动": "exp-10",
    "发财": "exp-10",
    "困": "exp-11",
    "困倦": "exp-11",
    "发懵": "exp-11",
    "躺平": "exp-11",
}


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


def _resolve_llm_service(db: Session, user: User) -> tuple[LLMService, str]:
    config = _config_out(db, user.id)
    provider = (config.provider or "rule_based").lower()
    if provider in {"rule_based", "rule-based", "builtin", "local"}:
        return LLMService(config, None), "rule_based"

    stored = crud.get_agent_config(db, user_id=user.id)
    api_key = decrypt_optional(stored.api_key if stored else None) if stored else None
    if not api_key or not (config.base_url or "").strip():
        # Keep provider type so caller can show explicit configuration errors
        # instead of silently falling back to rule-based templated replies.
        return LLMService(config, None), "openai"
    return LLMService(config, api_key), "openai"


def _normalize_workspace(raw: str) -> str:
    clean = " ".join((raw or "").strip().split())
    return (clean[:64] if clean else "default") or "default"


def _to_layout_cards(raw_cards: list[dict]) -> list[AelinLayoutCard]:
    out: list[AelinLayoutCard] = []
    for row in raw_cards[:120]:
        try:
            card = AelinLayoutCard(
                contact_id=int(row.get("contact_id") or 0),
                display_name=str(row.get("display_name") or f"contact-{row.get('contact_id') or 'unknown'}"),
                pinned=bool(row.get("pinned")),
                order=max(0, int(row.get("order") or 0)),
                x=max(0.0, float(row.get("x") or 0.0)),
                y=max(0.0, float(row.get("y") or 0.0)),
                width=float(row.get("width") or 312.0),
                height=float(row.get("height") or 316.0),
            )
        except Exception:
            continue
        if card.contact_id <= 0:
            continue
        out.append(card)
    out.sort(key=lambda x: (x.y, x.x, x.order, x.display_name))
    return out[:80]


def _build_context_bundle(db: Session, user_id: int, *, workspace: str, query: str) -> dict:
    workspace_norm = _normalize_workspace(workspace)
    snap = _memory.snapshot(db, user_id, query=query)
    note_rows = _memory.list_notes(db, user_id, limit=24)
    notes: list[AgentMemoryNoteOut] = []
    for row in note_rows:
        src = (row.source or "").strip().lower()
        if src == "todo" or src.startswith("card_layout"):
            continue
        notes.append(
            AgentMemoryNoteOut(
                id=row.id,
                kind=row.kind,
                content=row.content,
                source=row.source,
                updated_at=row.updated_at.isoformat() if row.updated_at else "",
            )
        )
        if len(notes) >= 12:
            break

    todos_raw = _memory.list_todos(db, user_id, include_done=False, limit=10)
    todos: list[AelinTodoItem] = []
    for row in todos_raw:
        try:
            todos.append(AelinTodoItem(**row))
        except Exception:
            continue

    pins_raw = _memory.recommend_pins(db, user_id, limit=6)
    pin_recommendations: list[AelinPinRecommendationItem] = []
    for row in pins_raw:
        try:
            pin_recommendations.append(AelinPinRecommendationItem(**row))
        except Exception:
            continue

    brief_raw = _memory.build_daily_brief(db, user_id)
    daily_brief = AelinDailyBrief(
        generated_at=brief_raw["generated_at"],
        summary=str(brief_raw.get("summary") or ""),
        top_updates=[AgentFocusItemOut(**item) for item in brief_raw.get("top_updates", [])],
        actions=[AelinDailyBriefAction(**item) for item in brief_raw.get("actions", [])],
    )

    layout_cards = _to_layout_cards(_memory.get_latest_layout_cards(db, user_id, workspace=workspace_norm))

    return {
        "workspace": workspace_norm,
        "summary": str(snap.get("summary") or ""),
        "focus_items": [AgentFocusItemOut(**item) for item in snap.get("focus_items", [])],
        "focus_items_raw": list(snap.get("focus_items", [])),
        "notes": notes,
        "notes_count": len(notes),
        "todos": todos,
        "pin_recommendations": pin_recommendations,
        "daily_brief": daily_brief,
        "layout_cards": layout_cards,
    }


def _to_citations(raw_focus_items: list[dict], max_items: int) -> list[AelinCitation]:
    items: list[AelinCitation] = []
    for row in raw_focus_items[: max(1, min(20, max_items))]:
        try:
            items.append(
                AelinCitation(
                    message_id=int(row.get("message_id") or 0),
                    source=str(row.get("source") or "unknown"),
                    source_label=str(row.get("source_label") or row.get("source") or "unknown"),
                    sender=str(row.get("sender") or ""),
                    sender_avatar_url=(
                        str(row.get("sender_avatar_url") or "").strip() or None
                    ),
                    title=str(row.get("title") or ""),
                    received_at=str(row.get("received_at") or ""),
                    score=float(row.get("score") or 0.0),
                )
            )
        except Exception:
            continue
    return items


def _hydrate_citation_avatars(
    db: Session,
    user_id: int,
    citations: list[AelinCitation],
) -> list[AelinCitation]:
    missing_ids = [int(it.message_id) for it in citations if not it.sender_avatar_url and int(it.message_id or 0) > 0]
    if not missing_ids:
        return citations

    rows = db.execute(
        select(Message.id, Contact.avatar_url)
        .join(Contact, Contact.id == Message.contact_id)
        .where(
            Message.user_id == user_id,
            Contact.user_id == user_id,
            Message.id.in_(missing_ids),
        )
    ).all()
    avatar_by_message_id: dict[int, str] = {}
    for message_id, avatar_url in rows:
        if avatar_url:
            avatar_by_message_id[int(message_id)] = str(avatar_url)

    if not avatar_by_message_id:
        return citations

    out: list[AelinCitation] = []
    for it in citations:
        if it.sender_avatar_url:
            out.append(it)
            continue
        avatar = avatar_by_message_id.get(int(it.message_id or 0))
        if avatar:
            out.append(it.model_copy(update={"sender_avatar_url": avatar}))
        else:
            out.append(it)
    return out


def _rule_based_answer(
    query: str,
    summary: str,
    citations: list[AelinCitation],
    *,
    brief_summary: str = "",
    todo_titles: list[str] | None = None,
    image_count: int = 0,
) -> str:
    image_tip = (
        f"\n\n你上传了 {image_count} 张图片。当前规则模式不具备图片理解能力，若需图像分析请配置支持视觉的模型。"
        if image_count > 0
        else ""
    )
    if not citations:
        todo_line = ""
        if todo_titles:
            todo_line = "\n\n你当前待跟进事项：\n" + "\n".join(f"- {title}" for title in todo_titles[:4])
        if summary:
            return (
                "我已在你的长期记忆中检索相关内容，但当前缺少足够的新证据。"
                f"\n\n当前记忆摘要：{_summarizer.summarize(summary)}"
                + (f"\n\n今日简报：{brief_summary}" if brief_summary else "")
                + todo_line
                + "\n\n建议：扩大追踪边界或先触发一次同步。"
                + image_tip
            )
        return (
            "当前还没有足够的信号证据。先连接数据源并同步后，我就能给出可追溯结论。"
            + (f"\n\n今日简报：{brief_summary}" if brief_summary else "")
            + todo_line
            + image_tip
        )

    top = citations[0]
    bullets = [
        f"- [{it.source_label}] {it.title}（{it.sender}，{it.received_at}）"
        for it in citations[:4]
    ]
    return (
        f"基于你最近的信号证据，和“{query.strip()}”最相关的线索是：\n"
        + "\n".join(bullets)
        + f"\n\n当前优先关注：{top.title}"
        + ("\n\n我也参考了你的长期记忆摘要。" if summary else "")
        + (f"\n\n今日简报：{brief_summary}" if brief_summary else "")
        + (
            "\n\n建议先处理待跟进事项：\n" + "\n".join(f"- {title}" for title in (todo_titles or [])[:3])
            if todo_titles
            else ""
        )
        + image_tip
    )


def _build_actions(
    query: str,
    citations: list[AelinCitation],
    *,
    has_todos: bool,
    track_suggestion: dict[str, str] | None = None,
) -> list[AelinAction]:
    actions: list[AelinAction] = [
        AelinAction(
            kind="open_desk",
            title="在 Desk 查看可视化证据",
            detail="打开 /desk，在卡片与时间线里核验上下文",
            payload={"path": "/desk", "query": query.strip()[:180]},
        ),
    ]
    if citations:
        actions.insert(
            0,
            AelinAction(
                kind="open_message",
                title="打开最高相关消息",
                detail=f"查看：{citations[0].title}",
                payload={"message_id": str(citations[0].message_id), "query": query.strip()[:180]},
            ),
        )
    if track_suggestion:
        target = str(track_suggestion.get("target") or "").strip()
        source = str(track_suggestion.get("source") or "auto").strip().lower()
        reason = str(track_suggestion.get("reason") or "").strip()
        if target:
            actions.append(
                AelinAction(
                    kind="confirm_track",
                    title=f"跟踪 {target} 的后续动态？",
                    detail=reason or "Aelin 判断这可能值得持续跟踪。",
                    payload={
                        "target": target[:240],
                        "source": source[:32] or "auto",
                        "query": query.strip()[:500],
                    },
                ),
            )
    if "追踪" not in query and "follow" not in query.lower():
        actions.append(
            AelinAction(
                kind="track_topic",
                title="持续追踪该主题",
                detail="将当前问题加入长期追踪边界",
                payload={"query": query.strip()},
            )
        )
    if has_todos:
        actions.append(
            AelinAction(
                kind="open_todos",
                title="查看待办跟进",
                detail="在 Desk 的 Agent 面板里处理待办",
                payload={"path": "/desk", "query": query.strip()[:180]},
            )
        )
    return actions[:4]


def _normalize_images(raw_images: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for item in raw_images[:4]:
        data_url = str(getattr(item, "data_url", "") or "").strip()
        name = str(getattr(item, "name", "") or "").strip()[:120]
        if not data_url.startswith("data:image/"):
            continue
        if ";base64," not in data_url:
            continue
        if len(data_url) > 3_000_000:
            continue
        out.append({"data_url": data_url, "name": name})
    return out


def _normalize_history(raw_turns: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for item in raw_turns[-12:]:
        role = str(getattr(item, "role", "") or "").strip().lower()
        content = str(getattr(item, "content", "") or "").strip()
        if role not in {"user", "assistant"}:
            continue
        if not content:
            continue
        out.append({"role": role, "content": content[:3000]})
    return out


def _parse_json_object(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    # Accept common fenced format: ```json { ... } ```
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _normalize_track_source(raw: str) -> str:
    src = (raw or "").strip().lower()
    alias = {
        "mail": "email",
        "imap": "email",
        "twitter": "x",
        "xhs": "xiaohongshu",
        "b站": "bilibili",
    }
    src = alias.get(src, src)
    if src in _TRACKABLE_SOURCES:
        return src
    return "auto"


def _normalize_web_queries(query: str, items: Any) -> list[str]:
    out: list[str] = []
    if isinstance(items, list):
        for it in items:
            text = str(it or "").strip()
            if not text:
                continue
            out.append(text[:180])
            if len(out) >= 3:
                break
    if not out and query.strip():
        out.append(query.strip()[:180])
    return out[:3]


def _is_smalltalk_query(query: str) -> bool:
    text = (query or "").strip().lower()
    if not text:
        return True
    signals = [
        "你好",
        "hello",
        "hi ",
        "在吗",
        "聊聊",
        "你觉得",
        "你怎么看",
        "心情",
        "焦虑",
        "emo",
        "哈哈",
        "谢谢",
        "晚安",
    ]
    return any(sig in text for sig in signals)


def _plan_tool_usage(
    *,
    query: str,
    service: LLMService,
    provider: str,
    memory_summary: str,
) -> dict[str, Any]:
    default_plan = {
        "need_local_search": False,
        "need_web_search": False,
        "web_queries": [],
        "track_suggestion": None,
        "reason": "planner_unavailable:chat_only",
    }
    if _is_smalltalk_query(query):
        return {**default_plan, "reason": "smalltalk:chat_only"}
    if provider == "rule_based" or not service.is_configured():
        return default_plan

    planning_prompt = (
        "你是 Aelin 的工具规划器。"
        "你可以决定是否调用两个工具："
        "1) local_search：检索用户本地已同步的消息/帖子/邮件；"
        "2) web_search：联网搜索公开信息。"
        "同时判断是否应建议用户开启长期跟踪。"
        "仅输出 JSON，不要输出其他文本。"
        "JSON 格式："
        "{"
        "\"need_local_search\": boolean,"
        "\"need_web_search\": boolean,"
        "\"web_queries\": string[],"
        "\"should_suggest_tracking\": boolean,"
        "\"tracking_target\": string,"
        "\"tracking_source\": \"auto|web|rss|x|douyin|xiaohongshu|weibo|bilibili|email\","
        "\"tracking_reason\": string,"
        "\"reason\": string"
        "}"
        "规划原则："
        "A) 普通聊天、观点讨论、情绪支持、创作请求 => 两个工具都关闭；"
        "B) 事实性、时效性问题（比赛、新闻、价格、政策、实时数据）=> 优先打开 web_search；"
        "C) 当问题明显依赖用户历史同步内容时才打开 local_search；"
        "D) 除非确定用户存在长期跟踪意图，否则不要建议跟踪。"
    )
    user_msg = (
        f"用户问题：{query.strip()}\n"
        f"已有长期记忆摘要：{'是' if bool((memory_summary or '').strip()) else '否'}\n"
        "请输出 JSON。"
    )
    try:
        raw = service._chat(
            messages=[
                {"role": "system", "content": planning_prompt},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=260,
            stream=False,
        )
        parsed = _parse_json_object(str(raw or ""))
        if not isinstance(parsed, dict):
            return {**default_plan, "reason": "planner_invalid_json:chat_only"}

        need_local = bool(parsed.get("need_local_search"))
        need_web = bool(parsed.get("need_web_search"))
        web_queries = _normalize_web_queries(query, parsed.get("web_queries"))
        should_track = bool(parsed.get("should_suggest_tracking"))
        track_target = str(parsed.get("tracking_target") or "").strip()[:240]
        track_source = _normalize_track_source(str(parsed.get("tracking_source") or "auto"))
        track_reason = str(parsed.get("tracking_reason") or "").strip()[:220]
        reason = str(parsed.get("reason") or "").strip()[:200] or "llm_planner"

        track_suggestion = None
        if should_track and track_target:
            track_suggestion = {
                "target": track_target,
                "source": track_source,
                "reason": track_reason or "Aelin 判断该主题值得持续跟踪。",
            }

        if need_web and not web_queries:
            web_queries = [query.strip()[:180]] if query.strip() else []
        return {
            "need_local_search": need_local,
            "need_web_search": need_web,
            "web_queries": web_queries,
            "track_suggestion": track_suggestion,
            "reason": f"llm:{reason}",
        }
    except Exception:
        return {**default_plan, "reason": "planner_error:chat_only"}


def _domain_from_url(url: str) -> str:
    try:
        host = urlparse(url).netloc.strip().lower()
        return host or "web"
    except Exception:
        return "web"


def _extract_score_clues(text: str) -> list[str]:
    src = (text or "").strip()
    if not src:
        return []
    out: list[str] = []
    seen: set[str] = set()
    pattern = re.compile(
        r"([A-Za-z\u4e00-\u9fff·]{1,24})?\s*(\d{2,3})\s*[-:：]\s*(\d{2,3})\s*([A-Za-z\u4e00-\u9fff·]{1,24})?"
    )
    for m in pattern.finditer(src):
        a = int(m.group(2))
        b = int(m.group(3))
        if a < 50 or b < 50 or a > 200 or b > 200:
            continue
        left = (m.group(1) or "").strip()
        right = (m.group(4) or "").strip()
        clue = re.sub(r"\s+", " ", f"{left} {a}:{b} {right}".strip())
        if not clue or clue in seen:
            continue
        seen.add(clue)
        out.append(clue)
        if len(out) >= 8:
            break
    return out


def _looks_like_link_dump_answer(answer: str) -> bool:
    text = (answer or "").strip().lower()
    if not text:
        return False
    bad_signals = [
        "可以在多个网站",
        "以下是一些可供参考的网站",
        "您可以访问这些网站",
        "你可以访问这些网站",
        "网站查询到",
        "duckduckgo",
        "yahoo",
    ]
    return any(sig in text for sig in bad_signals)


def _compose_web_first_answer(query: str, results: list[WebSearchResult]) -> str:
    if not results:
        return ""
    score_clues: list[str] = []
    highlights: list[str] = []
    seen_highlights: set[str] = set()
    for row in results[:10]:
        blob = f"{row.title} {row.snippet}".strip()
        for clue in _extract_score_clues(blob):
            if clue not in score_clues:
                score_clues.append(clue)
            if len(score_clues) >= 6:
                break
        snippet = (row.snippet or "").strip()
        if snippet:
            line = f"{row.title}：{snippet}"
            if line not in seen_highlights:
                seen_highlights.add(line)
                highlights.append(line)
        if len(highlights) >= 4 and len(score_clues) >= 6:
            break

    if score_clues:
        return (
            f"我先联网检索了“{query.strip()}”，当前抓到的比分线索如下：\n"
            + "\n".join(f"- {item}" for item in score_clues[:6])
            + "\n\n这些来自公开网页抓取，若你愿意我可以继续自动跟踪并持续更新。"
        )
    if highlights:
        return (
            f"我已经先联网检索了“{query.strip()}”。目前可确认的信息：\n"
            + "\n".join(f"- {item}" for item in highlights[:4])
            + "\n\n如果你希望，我可以继续自动跟踪这个主题。"
        )
    first = results[0]
    return (
        f"我已经先联网检索了“{query.strip()}”，但当前抓到的结果细节不足以直接下结论。"
        f"\n\n目前最相关线索：{first.title}（{_domain_from_url(first.url)}）"
        "\n\n我可以继续补抓更高质量的结果后再给你更具体的答案。"
    )


def _persist_web_search_results(
    db: Session,
    user_id: int,
    *,
    query: str,
    results: list[WebSearchResult],
) -> list[AelinCitation]:
    if not results:
        return []
    contact = crud.upsert_contact(db, user_id=user_id, handle="web:search", display_name="Web Search")
    now = datetime.now(timezone.utc)
    citations: list[AelinCitation] = []
    for idx, item in enumerate(results[:10]):
        title = (item.title or "").strip()[:220]
        url = (item.url or "").strip()
        snippet = (item.snippet or "").strip()
        fetched = (getattr(item, "fetched_excerpt", "") or "").strip()
        if fetched and len(snippet) < 120:
            snippet = fetched
        snippet = snippet[:2200]
        if not title or not url:
            continue
        external_id = f"web:{hashlib.sha1(url.encode('utf-8')).hexdigest()}"
        body = f"{snippet}\n\nURL: {url}\n查询: {query.strip()[:180]}"
        msg = crud.create_message(
            db,
            user_id=user_id,
            contact_id=contact.id,
            source="web",
            external_id=external_id,
            sender=_domain_from_url(url),
            subject=title,
            body=body,
            received_at=now,
            summary=snippet or title,
        )
        if msg is not None and getattr(msg, "id", None) is None:
            db.flush()
        if msg is None:
            msg = db.scalar(
                select(Message).where(
                    Message.user_id == user_id,
                    Message.source == "web",
                    Message.external_id == external_id,
                )
            )
        if msg is None:
            continue
        crud.touch_contact_last_message(db, contact=contact, received_at=now)
        citations.append(
            AelinCitation(
                message_id=int(msg.id),
                source="web",
                source_label="Web",
                sender=_domain_from_url(url),
                sender_avatar_url=None,
                title=title,
                received_at=now.strftime("%Y-%m-%d %H:%M"),
                score=max(0.2, 6.0 - float(idx)),
            )
        )
    if citations:
        db.flush()
    return citations


def _rule_based_chat_answer(query: str, *, memory_summary: str = "", brief_summary: str = "") -> str:
    q = (query or "").strip()
    if not q:
        return "我在。你可以直接告诉我想聊什么，或让我帮你跟进某个来源的更新。"
    if any(token in q.lower() for token in ["你好", "hi", "hello"]):
        return "你好，我在这。你可以把我当作长期记忆型助手，聊想法或让我去跟进你的信息源都可以。"
    base = "这是个好问题。"
    if memory_summary:
        base += "\n\n我也会参考你已有的长期记忆来保持上下文连续。"
    if brief_summary:
        base += f"\n\n如果你需要，我也可以基于今日简报继续展开：{brief_summary}"
    base += "\n\n如果问题涉及外部事实，我会先自动检索，再直接给你结论。"
    return base


def _normalize_expression_id(raw: str | None) -> str | None:
    text = (raw or "").strip().lower()
    if not text:
        return None
    alias = _AELIN_EXPRESSION_ALIASES.get(text)
    if alias:
        return alias
    if text.isdigit():
        n = int(text)
        if 1 <= n <= 11:
            text = f"exp-{n:02d}"
    if text.startswith("exp_"):
        text = "exp-" + text[4:]
    if re.fullmatch(r"exp-\d{1,2}", text):
        n = int(text.split("-", 1)[1])
        if 1 <= n <= 11:
            text = f"exp-{n:02d}"
    if text in _AELIN_EXPRESSION_IDS:
        return text
    return None


def _extract_expression_tag(answer: str) -> tuple[str, str | None]:
    text = (answer or "").strip()
    if not text:
        return "", None
    patterns = [
        r"\[(?:expression|expr|sticker|表情|情绪)\s*[:：]\s*([A-Za-z0-9_-]{1,16})\]",
        r"<(?:expression|expr|sticker)\s*[:：]\s*([A-Za-z0-9_-]{1,16})>",
    ]
    expression: str | None = None
    cleaned = text
    for pat in patterns:
        match = re.search(pat, cleaned, flags=re.I)
        if not match:
            continue
        expression = _normalize_expression_id(match.group(1))
        cleaned = re.sub(pat, "", cleaned, flags=re.I).strip()
        if expression:
            break
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned, expression


def _pick_expression(query: str, answer: str, *, generation_failed: bool = False) -> str:
    q = (query or "").lower()
    a = (answer or "").lower()
    text = f"{q}\n{a}"

    if generation_failed or any(token in text for token in ["失败", "错误", "抱歉", "无法", "暂不支持", "不确定"]):
        return "exp-07"
    if any(token in text for token in ["生气", "愤怒", "气死", "火大", "离谱"]):
        return "exp-08"
    if any(token in text for token in ["风险", "谨慎", "警告", "严肃", "注意", "不建议"]):
        return "exp-05"
    if any(token in text for token in ["过载", "太困", "睡了", "晚安", "休息", "累", "崩溃", "躺平"]):
        return "exp-11"
    if any(token in text for token in ["观察", "围观", "后续", "继续跟踪", "等等看"]):
        return "exp-06"
    if any(token in text for token in ["爱你", "喜欢", "心动", "可爱", "浪漫", "害羞", "脸红"]):
        return "exp-01"
    if any(token in text for token in ["赚", "盈利", "拿下", "搞定", "高收益", "发财"]):
        return "exp-10"
    if any(token in text for token in ["恭喜", "太棒", "厉害", "优秀", "好耶", "开心"]):
        return "exp-02"
    if any(token in text for token in ["谢谢", "感谢", "支持", "加油", "辛苦了"]):
        return "exp-03"
    if any(token in text for token in ["哈哈", "hh", "笑死", "有趣", "好玩"]):
        return "exp-09"
    if ("?" in q) or ("？" in q) or any(token in q for token in ["为什么", "怎么", "吗", "啥", "什么", "如何"]):
        return "exp-04"
    if any(token in text for token in ["收到", "明白", "ok", "好的", "安排"]):
        return "exp-06"
    return "exp-04"


def _expression_mapping_prompt() -> str:
    lines = []
    for exp_id in sorted(_AELIN_EXPRESSION_META.keys()):
        meta = _AELIN_EXPRESSION_META[exp_id]
        lines.append(f"- {exp_id}: {meta['label']}（{meta['usage']}）")
    return "\n".join(lines)


@router.get("/context", response_model=AelinContextResponse)
def get_aelin_context(
    workspace: str = Query(default="default", min_length=1, max_length=64),
    query: str = Query(default="", max_length=400),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bundle = _build_context_bundle(
        db,
        current_user.id,
        workspace=workspace,
        query=query,
    )
    return AelinContextResponse(
        workspace=bundle["workspace"],
        summary=bundle["summary"],
        focus_items=bundle["focus_items"],
        notes=bundle["notes"],
        notes_count=bundle["notes_count"],
        todos=bundle["todos"],
        pin_recommendations=bundle["pin_recommendations"],
        daily_brief=bundle["daily_brief"],
        layout_cards=bundle["layout_cards"],
        generated_at=datetime.now(timezone.utc),
    )


@router.post("/chat", response_model=AelinChatResponse)
def aelin_chat(
    payload: AelinChatRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    tool_trace: list[AelinToolStep] = []

    def add_trace(stage: str, *, status: str = "completed", detail: str = "", count: int = 0) -> None:
        tool_trace.append(AelinToolStep(stage=stage, status=status, detail=detail[:240], count=max(0, int(count or 0))))

    service, provider = _resolve_llm_service(db, current_user)
    llm_generation_failed = False

    base_bundle = _build_context_bundle(
        db,
        current_user.id,
        workspace=payload.workspace,
        query="",
    )
    memory_summary = str(base_bundle["summary"] or "")
    brief_summary = base_bundle["daily_brief"].summary if base_bundle.get("daily_brief") else ""
    todo_titles = [item.title for item in base_bundle["todos"]]
    images = _normalize_images(payload.images)
    history_turns = _normalize_history(payload.history)

    tool_plan = _plan_tool_usage(
        query=payload.query,
        service=service,
        provider=provider,
        memory_summary=memory_summary,
    )
    need_local_search = bool(tool_plan.get("need_local_search"))
    need_web_search = bool(tool_plan.get("need_web_search"))
    planning_reason = str(tool_plan.get("reason") or "planner:none")
    web_queries = _normalize_web_queries(payload.query, tool_plan.get("web_queries"))
    track_suggestion = tool_plan.get("track_suggestion")
    add_trace(
        "planner",
        status="completed",
        detail=f"{planning_reason}; local={'on' if need_local_search else 'off'}; web={'on' if need_web_search else 'off'}",
    )

    active_bundle = base_bundle
    local_citations: list[AelinCitation] = []
    if need_local_search:
        active_bundle = _build_context_bundle(
            db,
            current_user.id,
            workspace=payload.workspace,
            query=payload.query,
        )
        local_citations = _to_citations(active_bundle["focus_items_raw"], payload.max_citations)
        local_citations = _hydrate_citation_avatars(db, current_user.id, local_citations)
        add_trace("local_search", status="completed", detail="retrieved local memory signals", count=len(local_citations))
    else:
        add_trace("local_search", status="skipped", detail="planner disabled local search")

    web_citations: list[AelinCitation] = []
    web_evidence_lines: list[str] = []
    web_results_for_answer: list[WebSearchResult] = []
    if need_web_search and web_queries:
        for q in web_queries[:3]:
            rows = _web_search.search_and_fetch(q, max_results=5, fetch_top_k=3)
            if not rows:
                continue
            web_results_for_answer.extend(rows[:5])
            web_citations.extend(_persist_web_search_results(db, current_user.id, query=q, results=rows))
            for item in rows[:5]:
                host = _domain_from_url(item.url)
                snippet = ((getattr(item, "fetched_excerpt", "") or "").strip() or (item.snippet or "").strip())
                evidence = f"- [Web] {item.title} ({host})"
                if snippet:
                    evidence += f" | {snippet}"
                web_evidence_lines.append(evidence)
        add_trace("web_search", status="completed", detail="; ".join(web_queries[:3]), count=len(web_citations))
    elif need_web_search:
        add_trace("web_search", status="failed", detail="planner enabled but no query/result")
    else:
        add_trace("web_search", status="skipped", detail="planner disabled web search")

    citations = sorted(
        [*local_citations, *web_citations],
        key=lambda x: float(x.score or 0.0),
        reverse=True,
    )[: max(1, min(20, payload.max_citations))]

    pin_lines = [
        f"{item.display_name}（score {item.score:.1f}，未读 {item.unread_count}）"
        for item in active_bundle["pin_recommendations"][:4]
    ]
    memory_prompt = _memory.build_system_memory_prompt(
        db,
        current_user.id,
        query=payload.query if need_local_search else "",
    )

    if provider == "rule_based":
        add_trace("generation", status="completed", detail="rule_based response path")
        if local_citations:
            answer = _rule_based_answer(
                payload.query,
                memory_summary,
                citations,
                brief_summary=brief_summary,
                todo_titles=todo_titles,
                image_count=len(images),
            )
        elif web_evidence_lines:
            answer = _compose_web_first_answer(payload.query, web_results_for_answer)
        else:
            answer = _rule_based_chat_answer(
                payload.query,
                memory_summary=memory_summary,
                brief_summary=brief_summary,
            )
    elif not service.is_configured():
        add_trace("generation", status="failed", detail="llm client not configured")
        answer = (
            "当前无法初始化 LLM 客户端，Aelin 已停止静默降级。"
            "\n\n请检查设置中的 Provider / Base URL / API Key 是否正确，然后重试。"
            "\n\n提示：Base URL 应填写 API 根地址，而不是完整的 /chat/completions 路径。"
        )
    else:
        evidence_block = "\n".join(
            f"- [{it.source_label}] {it.title} ({it.sender}, {it.received_at})"
            for it in citations[:8]
        ) if citations else ""
        prompt = (
            "You are Aelin, a signal-native chat agent.\n"
            "Answer in Simplified Chinese.\n"
            "Default to normal conversational interaction.\n"
            "You must answer the user's question directly first.\n"
            "Do not ask users to manually search websites when web evidence is already provided.\n"
            "Only cite synced evidence when retrieval is actually provided.\n"
            "You MUST answer the user's actual question directly first.\n"
            "Tracking/subscription suggestions are optional and must be placed after the direct answer.\n"
            "If evidence is insufficient, say uncertainty explicitly and avoid fabricating details.\n"
            "Keep answer concise, practical, and natural.\n"
            "Use daily brief and pending todos only when they help this specific user question.\n"
            "Aelin has 11 expressions. Choose one according to semantics below:\n"
            + _expression_mapping_prompt()
            + "\n"
            "You MUST append exactly one tag at the very end: [expression:exp-XX].\n"
            "Do not output any other expression format.\n"
        )
        retrieval_note = f"规划结果：{planning_reason}。"
        retrieval_note += f" local_search={'on' if need_local_search else 'off'}; web_search={'on' if need_web_search else 'off'}。"
        user_msg = (
            f"用户问题：{payload.query.strip()}\n\n"
            f"工具规划：{retrieval_note}\n\n"
            + (
                "最近对话（供连续上下文参考）：\n"
                + "\n".join(
                    f"- {'用户' if turn['role'] == 'user' else 'Aelin'}: {turn['content'][:220]}"
                    for turn in history_turns[-6:]
                )
                + "\n\n"
                if history_turns
                else ""
            )
            + f"长期记忆摘要：{memory_summary or '暂无'}\n\n"
            + f"今日简报：{brief_summary or '暂无'}\n\n"
            + f"待跟进事项：{'; '.join(todo_titles[:5]) if todo_titles else '暂无'}\n\n"
            + f"置顶建议：{'; '.join(pin_lines) if pin_lines else '暂无'}\n\n"
            + (
                "用户上传图片：\n"
                + "\n".join(f"- {img['name'] or 'image'}" for img in images)
                + "\n\n"
                if images
                else ""
            )
            + (f"本地可用证据：\n{evidence_block}\n\n" if evidence_block else "")
            + (f"联网搜索结果：\n{chr(10).join(web_evidence_lines[:8])}\n" if web_evidence_lines else "")
        )
        llm_messages = [{"role": "system", "content": prompt}]
        if memory_prompt:
            llm_messages.append({"role": "system", "content": memory_prompt})
        if history_turns:
            llm_messages.extend(history_turns[-10:])
        if images:
            user_content: list[dict[str, Any]] = [{"type": "text", "text": user_msg}]
            for img in images:
                user_content.append({"type": "image_url", "image_url": {"url": img["data_url"]}})
            llm_messages.append({"role": "user", "content": user_content})
        else:
            llm_messages.append({"role": "user", "content": user_msg})
        llm_error: str | None = None
        try:
            raw = service._chat(
                messages=llm_messages,
                max_tokens=520,
                stream=False,
            )
            answer = str(raw).strip() if raw else ""
            add_trace("generation", status="completed", detail="llm generation succeeded")
        except Exception as e:
            llm_error = str(e)
            answer = ""
            llm_generation_failed = True
            add_trace("generation", status="failed", detail=f"llm error: {llm_error[:180]}")
            if images:
                # Some providers/models are text-only; retry once without image payload.
                fallback_messages: list[dict[str, Any]] = [{"role": "system", "content": prompt}]
                if memory_prompt:
                    fallback_messages.append({"role": "system", "content": memory_prompt})
                fallback_messages.append({"role": "user", "content": user_msg})
                try:
                    raw = service._chat(
                        messages=fallback_messages,
                        max_tokens=520,
                        stream=False,
                    )
                    maybe = str(raw).strip() if raw else ""
                    if maybe:
                        answer = (
                            "当前模型可能不支持图片输入，我已先基于文本上下文回答。\n\n"
                            + maybe
                        )
                        add_trace("generation", status="completed", detail="fallback text-only generation succeeded")
                except Exception as e2:
                    llm_error = llm_error or str(e2)
                    answer = ""
        if not answer:
            if citations:
                answer = _rule_based_answer(
                    payload.query,
                    memory_summary,
                    citations,
                    brief_summary=brief_summary,
                    todo_titles=todo_titles,
                    image_count=len(images),
                )
            else:
                answer = (
                    "我刚才调用外部模型失败了，先给你一个保底回复。"
                    + (f"\n\n错误：{llm_error}" if llm_error else "")
                    + "\n\n你可以先在设置页测试 Provider 连通性，然后我再继续正常对话。"
                    + "\n\n"
                    + _rule_based_chat_answer(
                        payload.query,
                        memory_summary=memory_summary,
                        brief_summary=brief_summary,
                    )
                )
        if answer and web_results_for_answer and _looks_like_link_dump_answer(answer):
            answer = _compose_web_first_answer(payload.query, web_results_for_answer)

    answer, tagged_expression = _extract_expression_tag(answer)
    expression = tagged_expression or _pick_expression(payload.query, answer, generation_failed=llm_generation_failed)

    if payload.use_memory and answer:
        _memory.update_after_turn(
            db,
            current_user.id,
            [{"role": "user", "content": payload.query}],
            answer,
        )
        db.commit()
    elif need_web_search and web_queries:
        # Persist fetched web records even if this round does not update chat memory.
        db.commit()

    return AelinChatResponse(
        answer=answer,
        expression=expression,
        citations=citations,
        actions=_build_actions(
            payload.query,
            citations,
            has_todos=bool(todo_titles),
            track_suggestion=track_suggestion if isinstance(track_suggestion, dict) else None,
        ),
        tool_trace=tool_trace[:8],
        memory_summary=memory_summary,
        generated_at=datetime.now(timezone.utc),
    )


def _infer_tracking_source(target: str) -> str:
    text = (target or "").strip().lower()
    if any(token in text for token in ["抖音", "douyin"]):
        return "douyin"
    if any(token in text for token in ["小红书", "xiaohongshu", "xhs"]):
        return "xiaohongshu"
    if any(token in text for token in ["微博", "weibo"]):
        return "weibo"
    if any(token in text for token in ["bilibili", "b站", "up主"]):
        return "bilibili"
    if any(token in text for token in ["twitter", "x.com", "推特", "x "]):
        return "x"
    if any(token in text for token in ["邮件", "邮箱", "email"]):
        return "email"
    if any(token in text for token in ["rss", "订阅"]):
        return "rss"
    return "web"


def _extract_x_username(target: str) -> str:
    text = (target or "").strip()
    if not text:
        return ""
    match = re.search(r"(?:x\.com/|twitter\.com/)?@?([A-Za-z0-9_]{1,15})", text, flags=re.I)
    if not match:
        return ""
    return match.group(1).lstrip("@").strip()


def _extract_bilibili_uid(target: str) -> str:
    text = (target or "").strip()
    if not text:
        return ""
    match = re.search(r"(?:space\.bilibili\.com/)?([1-9]\d{3,19})", text)
    return match.group(1).strip() if match else ""


def _build_tracking_account_seed(source: str, target: str, query: str) -> dict[str, str] | None:
    text = (target or query or "").strip()
    if not text:
        return None

    if source == "x":
        username = _extract_x_username(text)
        if not username:
            return None
        return {
            "provider": "x",
            "identifier": f"x:{username}",
            "feed_url": "",
            "feed_homepage_url": f"https://x.com/{username}",
            "feed_display_name": f"X @{username}",
        }
    if source == "douyin":
        sec_uid = extract_douyin_uid(text)
        if not sec_uid:
            return None
        return {
            "provider": "douyin",
            "identifier": sec_uid,
            "feed_url": "",
            "feed_homepage_url": f"https://www.douyin.com/user/{sec_uid}",
            "feed_display_name": "抖音用户",
        }
    if source == "xiaohongshu":
        user_id = extract_xhs_uid(text)
        if not user_id:
            return None
        return {
            "provider": "xiaohongshu",
            "identifier": user_id,
            "feed_url": "",
            "feed_homepage_url": f"https://www.xiaohongshu.com/user/profile/{user_id}",
            "feed_display_name": "小红书用户",
        }
    if source == "weibo":
        uid = extract_weibo_uid(text)
        if not uid:
            return None
        return {
            "provider": "weibo",
            "identifier": uid,
            "feed_url": "",
            "feed_homepage_url": f"https://weibo.com/u/{uid}",
            "feed_display_name": "微博用户",
        }
    if source == "bilibili":
        uid = _extract_bilibili_uid(text)
        if not uid:
            return None
        return {
            "provider": "bilibili",
            "identifier": f"bilibili:{uid}",
            "feed_url": "",
            "feed_homepage_url": f"https://space.bilibili.com/{uid}",
            "feed_display_name": f"B站 UP {uid}",
        }
    return None


def _ensure_tracking_account(
    db: Session,
    *,
    user_id: int,
    source: str,
    target: str,
    query: str,
) -> Any | None:
    seed = _build_tracking_account_seed(source, target, query)
    if not seed:
        return None

    existing = crud.get_account_by_provider_identifier(
        db,
        user_id=user_id,
        provider=seed["provider"],
        identifier=seed["identifier"],
    )
    if existing is not None:
        return existing

    try:
        return crud.create_connected_account(
            db,
            user_id=user_id,
            provider=seed["provider"],
            identifier=seed["identifier"],
            access_token=None,
            refresh_token=None,
            feed_url=seed.get("feed_url"),
            feed_homepage_url=seed.get("feed_homepage_url"),
            feed_display_name=seed.get("feed_display_name"),
        )
    except IntegrityError:
        db.rollback()
        return crud.get_account_by_provider_identifier(
            db,
            user_id=user_id,
            provider=seed["provider"],
            identifier=seed["identifier"],
        )
    except Exception:
        db.rollback()
        return None


def _persist_tracking_event(
    db: Session,
    *,
    user_id: int,
    target: str,
    source: str,
    query: str,
    status: str,
) -> int | None:
    contact = crud.upsert_contact(db, user_id=user_id, handle="aelin:tracking", display_name="Aelin Tracking")
    now = datetime.now(timezone.utc)
    seed = f"{target}|{query}|{status}|{now.strftime('%Y%m%d%H%M%S')}"
    external_id = f"aelin-track:{source}:{hashlib.sha1(seed.encode('utf-8')).hexdigest()}"
    body = (
        f"跟踪目标: {target}\n"
        f"来源: {source}\n"
        f"状态: {status}\n"
        f"触发问题: {query or '未提供'}\n"
        f"时间: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )
    msg = crud.create_message(
        db,
        user_id=user_id,
        contact_id=contact.id,
        source="aelin",
        external_id=external_id,
        sender="Aelin",
        subject=f"跟踪任务：{target[:80]}",
        body=body,
        received_at=now,
        summary=f"{source} / {status}",
    )
    if msg is not None and getattr(msg, "id", None) is None:
        db.flush()
    if msg is None:
        msg = db.scalar(
            select(Message).where(
                Message.user_id == user_id,
                Message.source == "aelin",
                Message.external_id == external_id,
            )
        )
    if msg is None:
        return None
    crud.touch_contact_last_message(db, contact=contact, received_at=now)
    db.flush()
    return int(msg.id)


def _extract_tracking_field(text: str, label: str) -> str:
    if not text:
        return ""
    match = re.search(rf"{re.escape(label)}\s*[:：]\s*(.+)", text, flags=re.I)
    if not match:
        return ""
    return (match.group(1) or "").strip().splitlines()[0].strip()


def _parse_tracking_payload(raw: str) -> dict[str, str]:
    text = (raw or "").strip()
    return {
        "target": _extract_tracking_field(text, "跟踪目标"),
        "source": _normalize_track_source(_extract_tracking_field(text, "来源") or "auto"),
        "status": _extract_tracking_field(text, "状态"),
        "query": _extract_tracking_field(text, "触发问题"),
        "time": _extract_tracking_field(text, "时间"),
    }


def _tracking_key(source: str, target: str) -> str:
    return f"{(source or 'auto').strip().lower()}::{(target or '').strip().lower()}"


def _load_tracking_events(db: Session, *, user_id: int, limit: int) -> dict[str, dict[str, Any]]:
    contact = db.scalar(
        select(Contact).where(
            Contact.user_id == user_id,
            Contact.handle == "aelin:tracking",
        )
    )
    if contact is None:
        return {}

    rows = crud.list_messages(
        db,
        user_id=user_id,
        contact_id=int(contact.id),
        limit=max(20, min(500, int(limit) * 4)),
    )
    out: dict[str, dict[str, Any]] = {}
    for msg in rows:
        parsed = _parse_tracking_payload(msg.body or "")
        target = (parsed.get("target") or "").strip()
        if not target:
            continue
        source = _normalize_track_source(parsed.get("source") or "auto")
        key = _tracking_key(source, target)
        if key in out:
            continue
        received = msg.received_at.isoformat() if msg.received_at else ""
        out[key] = {
            "message_id": int(msg.id),
            "target": target,
            "source": source,
            "query": (parsed.get("query") or "").strip(),
            "status": (parsed.get("status") or "").strip() or "active",
            "updated_at": received,
        }
    return out


@router.get("/tracking", response_model=AelinTrackingListResponse)
def list_trackings(
    limit: int = Query(default=80, ge=1, le=300),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    notes = db.scalars(
        select(AgentMemoryNote)
        .where(
            AgentMemoryNote.user_id == current_user.id,
            AgentMemoryNote.kind == "tracking",
        )
        .order_by(AgentMemoryNote.updated_at.desc(), AgentMemoryNote.id.desc())
        .limit(limit)
    ).all()

    events_by_key = _load_tracking_events(db, user_id=current_user.id, limit=limit)
    seen_keys: set[str] = set()
    items: list[AelinTrackingItem] = []

    for note in notes:
        parsed = _parse_tracking_payload(note.content or "")
        note_source = ""
        if (note.source or "").startswith("track:"):
            note_source = (note.source or "").split(":", 1)[1].strip()
        source = _normalize_track_source(parsed.get("source") or note_source or "auto")
        target = (parsed.get("target") or "").strip()
        if not target:
            continue
        key = _tracking_key(source, target)
        seen_keys.add(key)
        event = events_by_key.get(key)
        note_updated = note.updated_at.isoformat() if note.updated_at else ""
        items.append(
            AelinTrackingItem(
                note_id=int(note.id),
                message_id=int(event["message_id"]) if event and event.get("message_id") else None,
                target=target,
                source=source,
                query=(parsed.get("query") or "").strip(),
                status=(event.get("status") if event else "") or "active",
                updated_at=note_updated,
                status_updated_at=(event.get("updated_at") if event else "") or None,
            )
        )

    for key, event in events_by_key.items():
        if key in seen_keys:
            continue
        items.append(
            AelinTrackingItem(
                note_id=None,
                message_id=int(event["message_id"]) if event.get("message_id") else None,
                target=str(event.get("target") or "").strip(),
                source=_normalize_track_source(str(event.get("source") or "auto")),
                query=str(event.get("query") or "").strip(),
                status=str(event.get("status") or "").strip() or "active",
                updated_at=str(event.get("updated_at") or ""),
                status_updated_at=str(event.get("updated_at") or "") or None,
            )
        )

    items.sort(
        key=lambda row: (row.status_updated_at or row.updated_at or ""),
        reverse=True,
    )
    trimmed = items[:limit]
    return AelinTrackingListResponse(
        total=len(trimmed),
        items=trimmed,
        generated_at=datetime.now(timezone.utc),
    )


def _matching_accounts_for_tracking(accounts: list[Any], source: str) -> list[Any]:
    if source == "email":
        email_providers = {"imap", "gmail", "outlook", "forward"}
        return [a for a in accounts if str(getattr(a, "provider", "")).lower() in email_providers]
    return [a for a in accounts if str(getattr(a, "provider", "")).lower() == source]


@router.post("/track/confirm", response_model=AelinTrackConfirmResponse)
def confirm_track_subscription(
    payload: AelinTrackConfirmRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    target = payload.target.strip()[:240]
    query = (payload.query or "").strip()[:500]
    source = _normalize_track_source(payload.source)
    if source == "auto":
        source = _infer_tracking_source(target)

    note_content = (
        f"跟踪目标: {target}\n"
        f"来源: {source}\n"
        f"触发问题: {query or '未提供'}"
    )
    try:
        _memory.add_note(db, current_user.id, note_content, kind="tracking", source=f"track:{source}")
    except Exception:
        pass

    tracking_message_id = _persist_tracking_event(
        db,
        user_id=current_user.id,
        target=target,
        source=source,
        query=query,
        status="created",
    )

    if source == "web":
        search_query = query or target
        rows = _web_search.search_and_fetch(search_query, max_results=7, fetch_top_k=4)
        citations = _persist_web_search_results(db, current_user.id, query=search_query, results=rows)
        tracking_message_id = _persist_tracking_event(
            db,
            user_id=current_user.id,
            target=target,
            source=source,
            query=query,
            status="seeded",
        ) or tracking_message_id
        db.commit()
        action_payload: dict[str, str] = {"path": "/desk"}
        if tracking_message_id:
            action_payload["message_id"] = str(tracking_message_id)
        if target:
            action_payload["query"] = target[:120]
        return AelinTrackConfirmResponse(
            status="tracking_enabled",
            message=(
                f"已开启“{target}”的长期跟踪。"
                + ("我已先抓取一批公开信息并持久化到本地。" if citations else "我会在后续对话中继续补充数据。")
            ),
            provider="web",
            actions=[
                AelinAction(
                    kind="open_desk",
                    title="查看已保存数据",
                    detail="打开 Desk 查看刚保存的跟踪结果",
                    payload=action_payload,
                )
            ],
            generated_at=datetime.now(timezone.utc),
        )

    all_accounts = crud.list_accounts(db, user_id=current_user.id)
    matched = _matching_accounts_for_tracking(all_accounts, source)
    if not matched and source in {"x", "douyin", "xiaohongshu", "weibo", "bilibili"}:
        created = _ensure_tracking_account(
            db,
            user_id=current_user.id,
            source=source,
            target=target,
            query=query,
        )
        if created is not None:
            all_accounts = crud.list_accounts(db, user_id=current_user.id)
            matched = _matching_accounts_for_tracking(all_accounts, source)

    if not matched:
        tracking_message_id = _persist_tracking_event(
            db,
            user_id=current_user.id,
            target=target,
            source=source,
            query=query,
            status="needs_config",
        ) or tracking_message_id
        db.commit()
        payload_settings = {"path": "/settings", "provider": source}
        if target:
            payload_settings["target"] = target[:120]
        return AelinTrackConfirmResponse(
            status="needs_config",
            message=f"要跟踪“{target}”，你需要先配置 {source} 数据源。",
            provider=source,
            actions=[
                AelinAction(
                    kind="open_settings",
                    title="去设置数据源",
                    detail=f"当前缺少 {source} 配置，打开设置页完成接入",
                    payload=payload_settings,
                )
            ],
            generated_at=datetime.now(timezone.utc),
        )

    for account in matched[:4]:
        try:
            enqueue_sync_job(user_id=current_user.id, account_id=int(account.id), force_full=False)
        except Exception:
            continue
    tracking_message_id = _persist_tracking_event(
        db,
        user_id=current_user.id,
        target=target,
        source=source,
        query=query,
        status="sync_started",
    ) or tracking_message_id
    db.commit()
    action_payload = {"path": "/desk"}
    if tracking_message_id:
        action_payload["message_id"] = str(tracking_message_id)
    if target:
        action_payload["query"] = target[:120]
    return AelinTrackConfirmResponse(
        status="sync_started",
        message=f"已为“{target}”启动 {len(matched[:4])} 个同步任务，后续会持续更新并写入本地。",
        provider=source,
        actions=[
            AelinAction(
                kind="open_desk",
                title="查看同步进度",
                detail="打开 Desk 观察新数据写入",
                payload=action_payload,
            )
        ],
        generated_at=datetime.now(timezone.utc),
    )
