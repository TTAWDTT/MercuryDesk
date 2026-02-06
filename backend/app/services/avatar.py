from __future__ import annotations

import hashlib
import re
from email.utils import parseaddr

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_http_avatar_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if text.startswith("//"):
        text = f"https:{text}"
    if text.startswith("http://") or text.startswith("https://"):
        return text
    return None


def gravatar_url_for_email(value: object, *, size: int = 96, default_style: str = "identicon") -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    _name, addr = parseaddr(raw)
    email = (addr or raw).strip().lower()
    if not _EMAIL_RE.match(email):
        return None
    digest = hashlib.md5(email.encode("utf-8")).hexdigest()
    return f"https://www.gravatar.com/avatar/{digest}?s={int(size)}&d={default_style}"
