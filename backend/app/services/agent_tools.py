from __future__ import annotations

import json
from typing import Any, Callable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Contact, Message


def search_messages(db: Session, user_id: int, query: str) -> str:
    """Search messages for the current user."""
    stmt = (
        select(Message)
        .join(Contact)
        .where(Message.user_id == user_id)
        .where(
            or_(
                Message.subject.ilike(f"%{query}%"),
                Message.body.ilike(f"%{query}%"),
                Message.sender.ilike(f"%{query}%"),
                Contact.display_name.ilike(f"%{query}%"),
            )
        )
        .order_by(Message.received_at.desc())
        .limit(5)
    )
    results = db.scalars(stmt).all()
    if not results:
        return "No matching messages found."

    return json.dumps(
        [
            {
                "id": m.id,
                "sender": m.sender,
                "subject": m.subject,
                "date": str(m.received_at),
                "preview": m.body_preview[:100],
            }
            for m in results
        ],
        ensure_ascii=False,
    )


def get_contact_info(db: Session, user_id: int, name: str) -> str:
    """Get contact details by name or handle."""
    stmt = (
        select(Contact)
        .where(Contact.user_id == user_id)
        .where(
            or_(
                Contact.display_name.ilike(f"%{name}%"),
                Contact.handle.ilike(f"%{name}%"),
            )
        )
        .limit(1)
    )
    contact = db.scalar(stmt)
    if not contact:
        return f"Contact '{name}' not found."

    return json.dumps(
        {
            "id": contact.id,
            "name": contact.display_name,
            "handle": contact.handle,
            "unread": contact.messages[-1].is_read if contact.messages else False, # Simplified
        },
        ensure_ascii=False,
    )

# Tool Definitions for OpenAI
TOOLS_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_messages",
            "description": "Search for messages or emails based on keywords, sender, or subject.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search keyword (e.g., 'invoice', 'GitHub', 'John').",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_contact_info",
            "description": "Get detailed information about a specific contact.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The name or handle of the contact.",
                    }
                },
                "required": ["name"],
            },
        },
    },
]

class ToolExecutor:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.map: dict[str, Callable] = {
            "search_messages": self._search_messages,
            "get_contact_info": self._get_contact_info,
        }

    def _search_messages(self, query: str) -> str:
        return search_messages(self.db, self.user_id, query)

    def _get_contact_info(self, name: str) -> str:
        return get_contact_info(self.db, self.user_id, name)

    def execute(self, name: str, arguments: str) -> str:
        func = self.map.get(name)
        if not func:
            return f"Error: Tool '{name}' not found."
        try:
            kwargs = json.loads(arguments)
            return func(**kwargs)
        except Exception as e:
            return f"Error executing tool '{name}': {str(e)}"
