"""Refresh-body quirk + single-flight 401 handling (PLAN.md §2 fact #2, §5)."""
import asyncio
import json

import httpx
import pytest

from app.monnett_client import MonnettApiError, MonnettClient, RefreshFailed
from conftest import MockUpstream, run


def make_client(upstream: MockUpstream, access="old-jwt", refresh="r-1") -> MonnettClient:
    c = MonnettClient("https://api.test", transport=upstream.transport)
    c.set_tokens(access, refresh)
    return c


def test_refresh_body_is_bare_json_string(upstream):
    """The OpenAPI spec types the refresh body as {"type": "string"}: the token
    must be sent as a JSON string, not as {"refresh_token": ...}."""
    captured = {}

    def refresh_handler(req: httpx.Request) -> httpx.Response:
        captured["content"] = req.content
        captured["content_type"] = req.headers.get("content-type")
        return httpx.Response(200, json={"success": True, "payload": {"jwt": "new-jwt", "refresh_token": "r-2"}})

    upstream.add("POST", r"/api/refresh", refresh_handler)
    run(make_client(upstream).refresh())
    assert captured["content"] == json.dumps("r-1").encode()  # b'"r-1"'
    assert captured["content_type"] == "application/json"


def test_refresh_rotation_updates_refresh_token(upstream):
    upstream.json("POST", r"/api/refresh", {"success": True, "payload": {"jwt": "new-jwt", "refresh_token": "r-2"}})
    c = make_client(upstream)
    run(c.refresh())
    assert c.access_token == "new-jwt"
    assert c.refresh_token == "r-2"  # rotated
    assert c.refresh_count == 1


def test_refresh_keeps_old_refresh_token_when_absent(upstream):
    upstream.json("POST", r"/api/refresh", {"payload": {"jwt": "new-jwt"}})
    c = make_client(upstream)
    run(c.refresh())
    assert c.refresh_token == "r-1"


def test_single_flight_refresh_on_concurrent_401s(upstream):
    """N concurrent requests that all 401 must trigger exactly ONE refresh,
    then each retries once with the new token."""
    def feed_handler(req: httpx.Request) -> httpx.Response:
        if req.headers.get("Authorization") == "Bearer new-jwt":
            return httpx.Response(200, json={"timeline": [], "meta": {"pagination": {"page": 1}}})
        return httpx.Response(401, json={"error": {"message": "token expired"}})

    upstream.add("GET", r"/api/v1/app/feed", feed_handler)
    upstream.json("POST", r"/api/refresh", {"success": True, "payload": {"jwt": "new-jwt", "refresh_token": "r-2"}})

    async def main():
        c = make_client(upstream)
        results = await asyncio.gather(*[c.request("GET", "/api/v1/app/feed") for _ in range(5)])
        return c, results

    c, results = run(main())
    assert upstream.count("POST", r"/api/refresh") == 1, "refresh must be single-flight"
    assert all(r.data["timeline"] == [] for r in results)
    assert c.access_token == "new-jwt"


def test_no_retry_loop_when_upstream_keeps_401ing(upstream):
    """After refresh + exactly one retry, a still-401 response surfaces as an
    error. No retry storms on auth failures."""
    upstream.add("GET", r"/api/v1/app/feed", lambda req: httpx.Response(401, json={"error": {"message": "still bad"}}))
    upstream.json("POST", r"/api/refresh", {"payload": {"jwt": "new-jwt", "refresh_token": "r-2"}})

    c = make_client(upstream)
    with pytest.raises(MonnettApiError) as ei:
        run(c.request("GET", "/api/v1/app/feed"))
    assert ei.value.status == 401
    assert upstream.count("GET", r"/api/v1/app/feed") == 2  # original + exactly one retry


def test_refresh_failure_raises_refresh_failed(upstream):
    upstream.add("GET", r"/api/v1/app/feed", lambda req: httpx.Response(401, json={"error": {"message": "expired"}}))
    upstream.json("POST", r"/api/refresh", {"error": {"message": "refresh token revoked"}}, status=401)
    c = make_client(upstream)
    with pytest.raises(RefreshFailed) as ei:
        run(c.request("GET", "/api/v1/app/feed"))
    assert ei.value.code == "refresh_failed"


def test_refresh_success_false_envelope_is_refresh_failed(upstream):
    upstream.json("POST", r"/api/refresh", {"success": False, "message": "invalid token"})  # HTTP 200!
    c = make_client(upstream)
    with pytest.raises(RefreshFailed):
        run(c.refresh())


def test_no_refresh_without_refresh_token(upstream):
    upstream.add("GET", r"/api/v1/app/feed", lambda req: httpx.Response(401, json={"error": {"message": "x"}}))
    c = MonnettClient("https://api.test", transport=upstream.transport)  # no tokens at all
    with pytest.raises(MonnettApiError) as ei:
        run(c.request("GET", "/api/v1/app/feed"))
    assert ei.value.status == 401
    assert upstream.count("POST", r"/api/refresh") == 0
