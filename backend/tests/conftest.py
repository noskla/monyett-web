"""Shared fixtures: a route-based mock of the Monnett upstream.

All tests run against httpx.MockTransport / ASGITransport — the real
api.monnettsocial.com is never contacted from tests (PLAN.md §5).
"""
from __future__ import annotations

import asyncio
import re
from collections.abc import Callable

import httpx
import pytest

from app.config import Config
from app.main import create_app
from app import session as sess

TEST_SECRET = "test-secret"
TEST_PASSCODE = "pw123"


class MockUpstream:
    """Records every request; routes by (method, path regex) -> handler."""

    def __init__(self) -> None:
        self.routes: list[tuple[str, re.Pattern[str], Callable[[httpx.Request], httpx.Response]]] = []
        self.requests: list[httpx.Request] = []

    def add(self, method: str, pattern: str, handler: Callable[[httpx.Request], httpx.Response]) -> "MockUpstream":
        self.routes.append((method, re.compile(f"^{pattern}$"), handler))
        return self

    def json(self, method: str, pattern: str, body, status: int = 200) -> "MockUpstream":
        return self.add(method, pattern, lambda req: httpx.Response(status, json=body))

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        for method, rx, handler in self.routes:
            if method == request.method and rx.match(path):
                return handler(request)
        return httpx.Response(404, json={"error": {"message": f"no mock for {request.method} {path}", "code": "no_mock"}})

    @property
    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self)

    def count(self, method: str, pattern: str) -> int:
        rx = re.compile(f"^{pattern}$")
        return sum(1 for r in self.requests if r.method == method and rx.match(r.url.path))


def make_config(**overrides) -> Config:
    base = dict(
        monnett_api_base="https://api.test",
        session_secret=TEST_SECRET,
        client_access_passcode=TEST_PASSCODE,
        rate_limit_per_minute=60,
        environment="test",
        cookie_secure=False,
    )
    base.update(overrides)
    return Config(**base)


def run(coro):
    return asyncio.run(coro)


def session_cookie_header(access: str = "jwt-1", refresh: str = "r-1") -> dict[str, str]:
    token = sess.seal_session(TEST_SECRET, sess.SessionData(access, refresh))
    return {"Cookie": f"{sess.SESSION_COOKIE}={token}"}


def gate_cookie_header() -> dict[str, str]:
    return {"Cookie": f"{sess.GATE_COOKIE}={sess.seal_gate(TEST_SECRET)}"}


def merge_cookies(*headers: dict[str, str]) -> dict[str, str]:
    """Merge Cookie headers instead of overwriting each other."""
    parts = [h["Cookie"] for h in headers if "Cookie" in h]
    return {"Cookie": "; ".join(parts)}


@pytest.fixture
def upstream() -> MockUpstream:
    return MockUpstream()


@pytest.fixture
def app(upstream: MockUpstream):
    return create_app(make_config(), upstream_transport=upstream.transport)


async def asgi_client(app) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver")
