from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import re
from typing import Any, Iterable

from sqlalchemy import Select, desc, func, select
from sqlalchemy.orm import Session

from app.models import AgentConversationMemory, AgentMemoryNote, Contact, Message

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
_TODO_SOURCE = "todo"
_LAYOUT_SOURCE = "card_layout"


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

    if not out:
        m = re.search(r"我(关注|喜欢|不喜欢)\s*(.+)$", src)
        if m:
            note = _truncate(f"{m.group(1)}: {_clean_text(m.group(2))}", 280)
            if note:
                out.append(note)
    return out


def _parse_json_or_none(raw: str) -> Any | None:
    try:
        return json.loads(raw)
    except Exception:
        return None


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

    def _layout_source(self, workspace: str) -> str:
        clean = _truncate(_clean_text(workspace or "default"), 64) or "default"
        return _LAYOUT_SOURCE if clean == "default" else f"{_LAYOUT_SOURCE}:{clean}"

    def _parse_layout_cards_from_content(self, content: str) -> list[dict[str, Any]]:
        if not content:
            return []
        marker = "- 布局数据: "
        idx = content.find(marker)
        if idx < 0:
            return []
        raw = content[idx + len(marker):].strip()
        parsed = _parse_json_or_none(raw)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
        return []

    def get_latest_layout_cards(self, db: Session, user_id: int, workspace: str = "default") -> list[dict[str, Any]]:
        source = self._layout_source(workspace)
        row = db.scalar(
            select(AgentMemoryNote)
            .where(AgentMemoryNote.user_id == user_id, AgentMemoryNote.source == source)
            .order_by(AgentMemoryNote.updated_at.desc(), AgentMemoryNote.id.desc())
            .limit(1)
        )
        if row is None and workspace == "default":
            row = db.scalar(
                select(AgentMemoryNote)
                .where(AgentMemoryNote.user_id == user_id, AgentMemoryNote.source.like(f"{_LAYOUT_SOURCE}%"))
                .order_by(AgentMemoryNote.updated_at.desc(), AgentMemoryNote.id.desc())
                .limit(1)
            )
        if row is None:
            return []
        return self._parse_layout_cards_from_content(row.content)

    def upsert_card_layout(self, db: Session, user_id: int, cards: list[dict], *, workspace: str = "default") -> AgentMemoryNote:
        cleaned_cards: list[dict[str, object]] = []
        clean_workspace = _truncate(_clean_text(workspace), 64) or "default"
        for item in cards:
            try:
                contact_id = int(item.get("contact_id") or 0)
            except Exception:
                contact_id = 0
            if contact_id <= 0:
                continue

            display_name = _truncate(_clean_text(str(item.get("display_name") or "")), 60) or f"contact-{contact_id}"
            pinned = bool(item.get("pinned"))
            try:
                order = int(item.get("order") or 0)
            except Exception:
                order = 0
            order = max(0, order)
            try:
                x = float(item.get("x") or 0)
            except Exception:
                x = 0.0
            try:
                y = float(item.get("y") or 0)
            except Exception:
                y = 0.0
            x = max(0.0, x)
            y = max(0.0, y)
            try:
                width = float(item.get("width") or 312.0)
            except Exception:
                width = 312.0
            try:
                height = float(item.get("height") or 316.0)
            except Exception:
                height = 316.0
            width = max(120.0, min(2400.0, width))
            height = max(120.0, min(2400.0, height))
            cleaned_cards.append(
                {
                    "contact_id": contact_id,
                    "display_name": display_name,
                    "pinned": pinned,
                    "order": order,
                    "x": round(x, 1),
                    "y": round(y, 1),
                    "width": round(width, 1),
                    "height": round(height, 1),
                }
            )
            if len(cleaned_cards) >= 120:
                break

        cleaned_cards.sort(key=lambda x: (float(x["y"]), float(x["x"]), int(x["order"]), str(x["display_name"])))
        pinned_names = [str(c["display_name"]) for c in cleaned_cards if bool(c["pinned"])][:8]
        resized_names = [
            f"{c['display_name']}({int(float(c['width']))}x{int(float(c['height']))})"
            for c in cleaned_cards
            if abs(float(c["width"]) - 312.0) > 0.01 or abs(float(c["height"]) - 316.0) > 0.01
        ][:8]
        order_preview = [
            f"{c['display_name']}@({c['x']},{c['y']})[{int(float(c['width']))}x{int(float(c['height']))}]"
            for c in cleaned_cards[:12]
        ]

        summary_lines = [
            "卡片布局偏好:",
            f"- 工作区: {clean_workspace}",
            f"- 置顶: {', '.join(pinned_names) if pinned_names else '无'}",
            f"- 尺寸: {', '.join(resized_names) if resized_names else '默认'}",
            f"- 顺序预览: {' > '.join(order_preview) if order_preview else '无'}",
        ]
        payload = json.dumps(cleaned_cards, ensure_ascii=False, separators=(",", ":"))
        content = "\n".join(summary_lines) + f"\n- 布局数据: {payload}"
        content = _truncate(content, 3500)

        source = self._layout_source(clean_workspace)
        existing = db.scalar(
            select(AgentMemoryNote)
            .where(AgentMemoryNote.user_id == user_id, AgentMemoryNote.source == source)
            .order_by(AgentMemoryNote.updated_at.desc(), AgentMemoryNote.id.desc())
            .limit(1)
        )
        if existing is not None:
            existing.kind = "layout"
            existing.source = source
            existing.content = content
            db.add(existing)
            return existing

        row = AgentMemoryNote(
            user_id=user_id,
            kind="layout",
            source=source,
            content=content,
        )
        db.add(row)
        return row

    def list_todos(self, db: Session, user_id: int, *, include_done: bool = True, limit: int = 100) -> list[dict[str, Any]]:
        n = max(1, min(200, int(limit or 100)))
        rows = db.scalars(
            select(AgentMemoryNote)
            .where(AgentMemoryNote.user_id == user_id, AgentMemoryNote.source == _TODO_SOURCE)
            .order_by(desc(AgentMemoryNote.updated_at), desc(AgentMemoryNote.id))
            .limit(n)
        ).all()
        out: list[dict[str, Any]] = []
        for row in rows:
            parsed = _parse_json_or_none(row.content)
            if not isinstance(parsed, dict):
                continue
            done = bool(parsed.get("done"))
            if done and not include_done:
                continue
            out.append(
                {
                    "id": row.id,
                    "title": _truncate(_clean_text(str(parsed.get("title") or "")), 240),
                    "detail": _truncate(_clean_text(str(parsed.get("detail") or "")), 2000),
                    "done": done,
                    "due_at": _truncate(_clean_text(str(parsed.get("due_at") or "")), 64) or None,
                    "priority": _truncate(_clean_text(str(parsed.get("priority") or "normal")), 16) or "normal",
                    "contact_id": int(parsed.get("contact_id")) if str(parsed.get("contact_id") or "").isdigit() else None,
                    "message_id": int(parsed.get("message_id")) if str(parsed.get("message_id") or "").isdigit() else None,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else "",
                }
            )
        out.sort(key=lambda x: (x["done"], x["priority"] != "high", x["updated_at"]), reverse=False)
        return out

    def create_todo(
        self,
        db: Session,
        user_id: int,
        *,
        title: str,
        detail: str = "",
        due_at: str | None = None,
        priority: str = "normal",
        contact_id: int | None = None,
        message_id: int | None = None,
    ) -> AgentMemoryNote:
        payload = {
            "title": _truncate(_clean_text(title), 240),
            "detail": _truncate(_clean_text(detail), 2000),
            "done": False,
            "due_at": _truncate(_clean_text(due_at or ""), 64) or None,
            "priority": (_truncate(_clean_text(priority), 16) or "normal").lower(),
            "contact_id": contact_id,
            "message_id": message_id,
        }
        row = AgentMemoryNote(
            user_id=user_id,
            kind="todo",
            source=_TODO_SOURCE,
            content=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        )
        db.add(row)
        return row

    def update_todo(self, db: Session, user_id: int, todo_id: int, **updates: Any) -> AgentMemoryNote | None:
        row = db.scalar(
            select(AgentMemoryNote).where(
                AgentMemoryNote.user_id == user_id,
                AgentMemoryNote.id == todo_id,
                AgentMemoryNote.source == _TODO_SOURCE,
            )
        )
        if row is None:
            return None
        payload = _parse_json_or_none(row.content)
        if not isinstance(payload, dict):
            payload = {}

        for key in ("done", "title", "detail", "due_at", "priority"):
            if key not in updates or updates[key] is None:
                continue
            if key == "done":
                payload["done"] = bool(updates[key])
            elif key == "priority":
                payload[key] = (_truncate(_clean_text(str(updates[key])), 16) or "normal").lower()
            else:
                limit = 240 if key == "title" else 2000 if key == "detail" else 64
                payload[key] = _truncate(_clean_text(str(updates[key])), limit)

        row.content = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        db.add(row)
        return row

    def delete_todo(self, db: Session, user_id: int, todo_id: int) -> bool:
        row = db.scalar(
            select(AgentMemoryNote).where(
                AgentMemoryNote.user_id == user_id,
                AgentMemoryNote.id == todo_id,
                AgentMemoryNote.source == _TODO_SOURCE,
            )
        )
        if row is None:
            return False
        db.delete(row)
        return True

    def recommend_pins(self, db: Session, user_id: int, *, limit: int = 6) -> list[dict[str, Any]]:
        n = max(1, min(20, int(limit or 6)))
        contacts = db.scalars(select(Contact).where(Contact.user_id == user_id)).all()
        if not contacts:
            return []

        # Manual pin preference from recent workspace layouts.
        history_rows = db.scalars(
            select(AgentMemoryNote)
            .where(AgentMemoryNote.user_id == user_id, AgentMemoryNote.source.like(f"{_LAYOUT_SOURCE}%"))
            .order_by(desc(AgentMemoryNote.updated_at), desc(AgentMemoryNote.id))
            .limit(8)
        ).all()
        pin_history: Counter[int] = Counter()
        for row in history_rows:
            for item in self._parse_layout_cards_from_content(row.content):
                if not isinstance(item, dict):
                    continue
                if not bool(item.get("pinned")):
                    continue
                try:
                    cid = int(item.get("contact_id") or 0)
                except Exception:
                    cid = 0
                if cid > 0:
                    pin_history[cid] += 1

        now = datetime.now(timezone.utc)
        out: list[dict[str, Any]] = []
        for c in contacts:
            msgs = db.scalars(
                select(Message)
                .where(Message.user_id == user_id, Message.contact_id == c.id)
                .order_by(desc(Message.received_at), desc(Message.id))
                .limit(60)
            ).all()
            if not msgs:
                continue

            unread = sum(1 for m in msgs if not m.is_read)
            msg_count = len(msgs)
            last = msgs[0].received_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            age_hours = max(0.0, (now - last).total_seconds() / 3600.0)
            recency_score = max(0.0, 8.0 - age_hours / 10.0)
            history_score = min(4.0, pin_history.get(c.id, 0) * 1.25)
            unread_score = min(10.0, unread * 1.7)
            freq_score = min(4.0, msg_count * 0.08)
            score = unread_score + recency_score + history_score + freq_score

            reasons: list[str] = []
            if unread > 0:
                reasons.append(f"未读 {unread} 条")
            if recency_score >= 4:
                reasons.append("近期活跃")
            if pin_history.get(c.id, 0) > 0:
                reasons.append("你曾多次手动置顶")
            if msg_count >= 12:
                reasons.append("互动频率高")

            out.append(
                {
                    "contact_id": c.id,
                    "display_name": c.display_name,
                    "score": round(score, 2),
                    "reasons": reasons[:4],
                    "unread_count": unread,
                    "last_message_at": c.last_message_at,
                }
            )

        out.sort(key=lambda x: (x["score"], x["unread_count"]), reverse=True)
        return out[:n]

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

    def build_daily_brief(self, db: Session, user_id: int) -> dict[str, Any]:
        focus_items = self.build_focus_items(db, user_id, query="", limit=6)
        todos = self.list_todos(db, user_id, include_done=False, limit=20)

        actions: list[dict[str, Any]] = []
        for item in focus_items[:3]:
            actions.append(
                {
                    "kind": "review",
                    "title": f"查看: {item.title}",
                    "detail": f"来源 { _SOURCE_LABELS.get(item.source, item.source) }，发送者 {item.sender}",
                    "message_id": item.message_id,
                    "priority": "high" if item.score >= 8 else "normal",
                }
            )

        for todo in todos[:4]:
            actions.append(
                {
                    "kind": "todo",
                    "title": todo["title"],
                    "detail": todo.get("detail") or "",
                    "contact_id": todo.get("contact_id"),
                    "message_id": todo.get("message_id"),
                    "priority": todo.get("priority") or "normal",
                }
            )

        total_unread = db.scalar(
            select(func.count(Message.id)).where(Message.user_id == user_id, Message.is_read.is_(False))
        )
        unread_count = int(total_unread or 0)
        summary_parts = [
            f"今天你有 {unread_count} 条未读消息",
            f"高价值更新 {len(focus_items[:3])} 条",
            f"待跟进事项 {len(todos)} 项",
        ]

        return {
            "generated_at": datetime.now(timezone.utc),
            "summary": "；".join(summary_parts) + "。",
            "top_updates": [
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
            "actions": actions[:10],
        }

    def advanced_search(
        self,
        db: Session,
        user_id: int,
        *,
        query: str,
        source: str | None,
        unread_only: bool,
        days: int,
        limit: int,
    ) -> dict[str, Any]:
        day_window = max(1, min(365, int(days or 30)))
        max_items = max(1, min(100, int(limit or 20)))
        source_norm = _clean_text(source or "").lower()

        since = datetime.now(timezone.utc) - timedelta(days=day_window)
        stmt = select(Message).where(Message.user_id == user_id, Message.received_at >= since)
        if source_norm:
            stmt = stmt.where(Message.source == source_norm)
        if unread_only:
            stmt = stmt.where(Message.is_read.is_(False))

        rows = db.scalars(stmt.order_by(desc(Message.received_at), desc(Message.id)).limit(800)).all()
        terms = _extract_terms(query)

        scored: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc)
        for m in rows:
            received = m.received_at
            if received.tzinfo is None:
                received = received.replace(tzinfo=timezone.utc)
            age_hours = max(0.0, (now - received).total_seconds() / 3600.0)
            recency = max(0.0, 6.0 - age_hours / 24.0)

            text_blob = f"{m.sender} {m.subject} {m.body_preview}".lower()
            keyword = 0.0
            hit_terms: list[str] = []
            if terms:
                for t in terms:
                    if t in text_blob:
                        keyword += 2.0
                        hit_terms.append(t)
                keyword = min(12.0, keyword)
            else:
                keyword = 1.0

            unread_bonus = 1.2 if not m.is_read else 0.0
            score = recency + keyword + unread_bonus
            if score <= 0.2:
                continue

            reason = "关键词命中" if hit_terms else "近期消息"
            if unread_bonus > 0:
                reason += " + 未读优先"

            scored.append(
                {
                    "message_id": m.id,
                    "contact_id": m.contact_id,
                    "sender": _truncate(_clean_text(m.sender or ""), 80),
                    "subject": _truncate(_clean_text(m.subject or ""), 180),
                    "source": m.source,
                    "received_at": received.strftime("%Y-%m-%d %H:%M"),
                    "preview": _truncate(_clean_text(m.body_preview or m.body or ""), 280),
                    "is_read": bool(m.is_read),
                    "score": round(score, 2),
                    "reason": reason,
                }
            )

        scored.sort(key=lambda x: (x["score"], x["received_at"]), reverse=True)
        return {"total": len(scored), "items": scored[:max_items]}

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

        layout_cards = self.get_latest_layout_cards(db, user_id, workspace="default")
        if layout_cards:
            ordered = sorted(layout_cards, key=lambda x: (float(x.get("y") or 0), float(x.get("x") or 0)))
            pinned = [c for c in ordered if bool(c.get("pinned"))][:6]
            top_front = ordered[:6]
            front_names = [str(c.get("display_name") or c.get("contact_id")) for c in top_front]
            pinned_names = [str(c.get("display_name") or c.get("contact_id")) for c in pinned]
            lines = [
                f"- 置顶联系人: {', '.join(pinned_names) if pinned_names else '无'}",
                f"- 画板前排: {', '.join(front_names) if front_names else '无'}",
            ]
            parts.append("当前画板优先联系人（优先参考）:\n" + "\n".join(lines))

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
