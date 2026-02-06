from __future__ import annotations

import re
from email.utils import parseaddr
from hashlib import sha256

_FORWARD_ALIAS_RE = re.compile(r"^md-(?P<account_id>\d+)-(?P<signature>[a-f0-9]{10})$")


def _forward_signature(*, account_id: int, inbound_secret: str) -> str:
    return sha256(f"{account_id}:{inbound_secret}".encode("utf-8")).hexdigest()[:10]


def build_forward_alias(*, account_id: int, inbound_secret: str) -> str:
    return f"md-{account_id}-{_forward_signature(account_id=account_id, inbound_secret=inbound_secret)}"


def build_forward_address(*, account_id: int, inbound_secret: str, domain: str) -> str:
    normalized_domain = domain.strip().lower().lstrip("@")
    if not normalized_domain:
        raise ValueError("forward inbound domain is empty")
    alias = build_forward_alias(account_id=account_id, inbound_secret=inbound_secret)
    return f"{alias}@{normalized_domain}"


def parse_forward_recipient(recipient: str) -> tuple[int, str] | None:
    parsed = parseaddr(recipient)[1] or recipient.strip()
    if not parsed:
        return None
    local_part = parsed.split("@", 1)[0].lower()
    match = _FORWARD_ALIAS_RE.fullmatch(local_part)
    if match is None:
        return None
    return int(match.group("account_id")), match.group("signature")


def verify_forward_signature(*, account_id: int, inbound_secret: str, signature: str) -> bool:
    expected = _forward_signature(account_id=account_id, inbound_secret=inbound_secret)
    return expected == signature.strip().lower()
