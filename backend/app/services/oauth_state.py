from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock


@dataclass
class _OAuthState:
    user_id: int
    provider: str
    created_at: datetime


_states: dict[str, _OAuthState] = {}
_lock = Lock()
_ttl = timedelta(minutes=10)


def issue_state(*, user_id: int, provider: str) -> str:
    token = secrets.token_urlsafe(32)
    with _lock:
        _states[token] = _OAuthState(
            user_id=user_id,
            provider=provider.lower().strip(),
            created_at=datetime.now(timezone.utc),
        )
    return token


def consume_state(*, token: str, provider: str) -> int:
    provider_norm = provider.lower().strip()
    now = datetime.now(timezone.utc)
    with _lock:
        state = _states.pop(token, None)
        expired = [
            key
            for key, item in _states.items()
            if now - item.created_at > _ttl
        ]
        for key in expired:
            _states.pop(key, None)

    if state is None:
        raise ValueError("state 已失效，请重新发起授权")
    if state.provider != provider_norm:
        raise ValueError("state 与 provider 不匹配")
    if now - state.created_at > _ttl:
        raise ValueError("授权已超时，请重新发起")
    return state.user_id
