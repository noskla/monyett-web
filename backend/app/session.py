"""Encrypted session cookie + passcode gate cookie.

The session cookie is Fernet-encrypted (confidentiality + integrity) so the
JWT and refresh token never appear in readable form and cannot be tampered
with. itsdangerous alone would only sign; Fernet also encrypts.
"""
from __future__ import annotations

import base64
import hashlib
import time
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken

SESSION_COOKIE = "monnett_session"
GATE_COOKIE = "monnett_gate"
SESSION_MAX_AGE = 30 * 24 * 3600  # 30 days; upstream JWTs expire sooner anyway
GATE_MAX_AGE = 30 * 24 * 3600


def _fernet(secret: str) -> Fernet:
    # Derive a stable 32-byte Fernet key from the configured secret.
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


@dataclass(frozen=True)
class SessionData:
    access_token: str
    refresh_token: str


def seal_session(secret: str, data: SessionData) -> str:
    payload = f"{data.access_token}\n{data.refresh_token}"
    return _fernet(secret).encrypt(payload.encode()).decode()


def unseal_session(secret: str, token: str | None) -> SessionData | None:
    if not token:
        return None
    try:
        raw = _fernet(secret).decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None
    parts = raw.split("\n")
    if len(parts) != 2 or not all(parts):
        return None
    return SessionData(access_token=parts[0], refresh_token=parts[1])


def seal_gate(secret: str) -> str:
    return _fernet(secret + ":gate").encrypt(f"gate:{int(time.time())}".encode()).decode()


def unseal_gate(secret: str, token: str | None) -> bool:
    if not token:
        return False
    try:
        raw = _fernet(secret + ":gate").decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return False
    return raw.startswith("gate:")
