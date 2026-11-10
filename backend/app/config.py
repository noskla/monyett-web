"""Environment-driven configuration. No secrets in code; everything via env vars.

Env vars:
  MONNETT_API_BASE          upstream host, default https://api-dev.monnettsocial.com
  SESSION_SECRET            secret for the Fernet-encrypted session cookie (required in prod)
  CLIENT_ACCESS_PASSCODE    if set, the app is gated behind this passcode
  RATE_LIMIT_PER_MINUTE     global guardrail on /m/* proxy calls (default 60)
  ENVIRONMENT               "dev" | "prod" (informational, default derived from base URL)
  COOKIE_SECURE             "true"/"false" to force the Secure cookie flag;
                            unset = auto (https or X-Forwarded-Proto: https)
"""
from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass

log = logging.getLogger("monnett.config")


def _as_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    monnett_api_base: str
    session_secret: str
    client_access_passcode: str | None
    rate_limit_per_minute: int
    environment: str
    cookie_secure: bool | None  # None = auto-detect per request
    # Phase 3 feature flags (PLAN.md §4): disable any via ENABLE_X=false
    enable_create_post: bool = True
    enable_notifications: bool = True
    enable_stories: bool = True
    enable_discover: bool = True

    @classmethod
    def from_env(cls) -> "Config":
        base = os.getenv("MONNETT_API_BASE", "https://api-dev.monnettsocial.com").rstrip("/")
        secret = os.getenv("SESSION_SECRET")
        if not secret:
            secret = secrets.token_urlsafe(48)
            log.warning(
                "SESSION_SECRET not set; using an ephemeral secret. All sessions "
                "invalidate on restart. Set SESSION_SECRET when deploying."
            )
        passcode = os.getenv("CLIENT_ACCESS_PASSCODE") or None
        environment = os.getenv("ENVIRONMENT") or ("dev" if "dev" in base else "prod")
        return cls(
            monnett_api_base=base,
            session_secret=secret,
            client_access_passcode=passcode,
            rate_limit_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")),
            environment=environment,
            cookie_secure=_as_bool(os.getenv("COOKIE_SECURE")),
            enable_create_post=_as_bool(os.getenv("ENABLE_CREATE_POST", "true")) is not False,
            enable_notifications=_as_bool(os.getenv("ENABLE_NOTIFICATIONS", "true")) is not False,
            enable_stories=_as_bool(os.getenv("ENABLE_STORIES", "true")) is not False,
            enable_discover=_as_bool(os.getenv("ENABLE_DISCOVER", "true")) is not False,
        )
