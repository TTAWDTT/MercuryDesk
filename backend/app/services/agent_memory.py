from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Iterable

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import AgentConversationMemory, AgentMemoryNote, Message

_SOCIAL_SOURCES = {"x", "douyin", "bilibili", "xiaohongshu", "weibo", "rss"}
_SOURCE_LABELS = {
    "x": "X",
    "douyin": "抖音",
    "bilibili": "Bilibili",
    "xiaohongshu": "小红书",
    "weibo": "微博",
    "rss": "RSS",
    "github": "GitHub",
    "imap": "Email",
    "mock": "消息",
}


@dataclass
class FocusItem:
    message_id: int
    source: str
    sender: str
    title: str
    received_at: str
    score: float


def _truncate(text: str, limit: int) -> str:
    s = (text or "").strip()
    if len(s) <= limit:
        return s
    return s[: max(0, limit - 1)].rstrip() + "…"


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _extract_terms(query: str) -> list[str]:
    parts = re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z0-9_]{3,}", (query or "").lower())
    seen: set[str] = set()
    out: list[str] = []
    for p in parts:
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
        if len(out) >= 10:
            break
    return out


def _note_candidates_from_user_text(text: str) -> list[str]:
    src = _clean_text(text)
    if not src:
        return []

    patterns = [
        r"(?:请)?记住[:：]?\s*(.+)$",
        r"帮我记(?:一下|住)?[:：]?\s*(.+)$",
        r"remember(?: that)?[:：]?\s*(.+)$",
        r"我最近在关注[:：]?\s*(.+)$",
        r"我最近在看[:：]?\s*(.+)$",
    ]
    out: list[str] = []
    for p in patterns:
        m = re.search(p, src, flags=re.IGNORECASE)
        if not m:
            continue
        note = _truncate(_clean_text(m.group(1)), 280)
        if note:
            out.append(note)

    # Heuristic fallback: "我关注 X / 我喜欢 X / 我不喜欢 X"
    if not out:
        m = re.search(r"我(关注|喜欢|不喜欢)\s*(.+)$", src)
        if m:
            note = _truncate(f"{m.group(1)}: {_clean_text(m.group(2))}", 280)
            if note:
                out.append(note)
    return out


class AgentMemoryService:
    def get_summary(self, db: Session, user_id: int) -> str:
        row = db.get(AgentConversationMemory, user_id)
        if row is None:
            return ""
        return (row.summary or "").strip()

    def set_summary(self, db: Session, user_id: int, summary: str) -> None:
        row = db.get(AgentConversationMemory, user_id)
        clean_summary = _truncate(_clean_text(summary), 1800)
        if row is None:
            row = AgentConversationMemory(user_id=user_id, summary=clean_summary)
            db.add(row)
        else:
            row.summary = clean_summary
            db.add(row)

    def list_notes(self, db: Session, user_id: int, limit: int = 12) -> list[AgentMemoryNote]:
        n = max(1, min(50, int(limit or 12)))
        stmt = (
            select(AgentMemoryNote)
            .where(AgentMemoryNote.user_id == user_id)
            .order_by(AgentMemoryNote.updated_at.desc(), AgentMemoryNote.id.desc())
            .limit(n)
        )
        return db.scalars(stmt).all()

    def add_note(self, db: Session, user_id: int, content: str, *, kind: str = "note", source: str | None = None) -> AgentMemoryNote:
        clean = _truncate(_clean_text(content), 500)
        if not clean:
            raise ValueError("memory note content is empty")
        dup_stmt: Select[tuple[AgentMemoryNote]] = (
            select(AgentMemoryNote)
            .where(AgentMemoryNote.user_id == user_id, AgentMemoryNote.content == clean)
            .order_by(AgentMemoryNote.updated_at.desc(), AgentMemoryNote.id.desc())
            .limit(1)
        )
        existing = db.scalar(dup_stmt)
        if existing is not None:
            existing.kind = kind
            existing.source = source
            db.add(existing)
            return existing

        row = AgentMemoryNote(
            user_id=user_id,
            kind=_truncate(_clean_text(kind), 32) or "note",
            content=clean,
            source=_truncate(_clean_text(source or ""), 64) or None,
        )
        db.add(row)
        return row

    def delete_note(self, db: Session, user_id: int, note_id: int) -> bool:
        stmt = select(AgentMemoryNote).where(AgentMemoryNote.user_id == user_id, AgentMemoryNote.id == note_id)
        row = db.scalar(stmt)
        if row is None:
            return False
        db.delete(row)
        return True

    def build_focus_items(self, db: Session, user_id: int, *, query: str = "", limit: int = 8) -> list[FocusItem]:
        n = max(1, min(20, int(limit or 8)))
        stmt = (
            select(Message)
            .where(Message.user_id == user_id)
            .order_by(Message.received_at.desc(), Message.id.desc())
            .limit(200)
        )
        rows = db.scalars(stmt).all()
        if not rows:
            return []

        terms = _extract_terms(query)
        contact_hits = Counter(m.contact_id for m in rows if m.contact_id is not None)
        now = datetime.now(timezone.utc)
        scored: list[FocusItem] = []

        for m in rows:
            title = _clean_text(m.subject or "") or _clean_text(m.body_preview or "")
            if not title:
                continue

            received = m.received_at
            if received.tzinfo is None:
                received = received.replace(tzinfo=timezone.utc)
            age_hours = max(0.0, (now - received).total_seconds() / 3600.0)
            recency_score = max(0.0, 8.0 - age_hours / 12.0)

            source = (m.source or "").lower()
            source_bonus = 2.0 if source in _SOCIAL_SOURCES else 0.4
            contact_bonus = min(2.0, contact_hits.get(m.contact_id, 0) * 0.2)
            unread_bonus = 0.7 if not m.is_read else 0.0

            text_blob = f"{m.sender} {m.subject} {m.body_preview}".lower()
            keyword_bonus = 0.0
            if terms:
                for t in terms:
                    if t in text_blob:
                        keyword_bonus += 1.5
                keyword_bonus = min(6.0, keyword_bonus)

            score = recency_score + source_bonus + contact_bonus + unread_bonus + keyword_bonus
            scored.append(
                FocusItem(
                    message_id=m.id,
                    source=source or "unknown",
                    sender=_truncate(_clean_text(m.sender or ""), 60),
                    title=_truncate(title, 140),
                    received_at=received.strftime("%Y-%m-%d %H:%M"),
                    score=score,
                )
            )

        scored.sort(key=lambda x: (x.score, x.received_at), reverse=True)
        return scored[:n]

    def snapshot(self, db: Session, user_id: int, *, query: str = "") -> dict:
        notes = self.list_notes(db, user_id, limit=12)
        focus_items = self.build_focus_items(db, user_id, query=query, limit=8)
        return {
            "summary": self.get_summary(db, user_id),
            "notes": [
                {
                    "id": n.id,
                    "kind": n.kind,
                    "content": n.content,
                    "source": n.source,
                    "updated_at": n.updated_at.isoformat() if n.updated_at else "",
                }
                for n in notes
            ],
            "focus_items": [
                {
                    "message_id": item.message_id,
                    "source": item.source,
                    "source_label": _SOURCE_LABELS.get(item.source, item.source),
                    "sender": item.sender,
                    "title": item.title,
                    "received_at": item.received_at,
                    "score": round(item.score, 2),
                }
                for item in focus_items
            ],
        }

    def build_system_memory_prompt(self, db: Session, user_id: int, *, query: str = "") -> str:
        snap = self.snapshot(db, user_id, query=query)
        parts: list[str] = []

        summary = _clean_text(snap["summary"])
        if summary:
            parts.append(f"短期记忆（最近对话摘要）:\n{_truncate(summary, 1000)}")

        notes = snap["notes"][:8]
        if notes:
            lines = [f"- {n['content']}" for n in notes]
            parts.append("长期记忆（用户偏好/已确认信息）:\n" + "\n".join(lines))

        focus_items = snap["focus_items"][:8]
        if focus_items:
            lines = [
                f"- [{it['source_label']}] {it['title']} (from {it['sender']}, {it['received_at']})"
                for it in focus_items
            ]
            parts.append("最近关注信息与帖子（优先参考）:\n" + "\n".join(lines))

        return "\n\n".join(parts).strip()

    def update_after_turn(self, db: Session, user_id: int, messages: Iterable[dict[str, str]], assistant_reply: str) -> None:
        cleaned_msgs = [
            {
                "role": (m.get("role") or "").strip().lower(),
                "content": _truncate(_clean_text(m.get("content") or ""), 220),
            }
            for m in messages
            if isinstance(m, dict)
        ]
        chat_lines = [m for m in cleaned_msgs if m["role"] in {"user", "assistant"} and m["content"]]
        if chat_lines:
            tail = chat_lines[-10:]
            transcript = "\n".join(("用户" if m["role"] == "user" else "助手") + ": " + m["content"] for m in tail)
            base = self.get_summary(db, user_id)
            merged = f"{base}\n近期对话更新:\n{transcript}" if base else f"近期对话更新:\n{transcript}"
            self.set_summary(db, user_id, merged)

        last_user = ""
        for m in reversed(cleaned_msgs):
            if m["role"] == "user" and m["content"]:
                last_user = m["content"]
                break

        candidates = _note_candidates_from_user_text(last_user)
        if assistant_reply:
            assistant_short = _truncate(_clean_text(assistant_reply), 180)
            if assistant_short and ("记住" in last_user or "remember" in last_user.lower()):
                candidates.append(f"用户最近确认: {assistant_short}")

        deduped: list[str] = []
        seen: set[str] = set()
        for c in candidates:
            if c in seen:
                continue
            seen.add(c)
            deduped.append(c)
            if len(deduped) >= 3:
                break

        for c in deduped:
            self.add_note(db, user_id, c, kind="preference", source="chat")

