"""App-level tests: gate, /m/* allowlist, query/body forwarding, proxy shape."""
import json

import httpx

from conftest import asgi_client, gate_cookie_header, merge_cookies, run, session_cookie_header


def both_cookies(**kw):
    return merge_cookies(gate_cookie_header(), session_cookie_header(**kw))


def test_healthz_never_gated(app):
    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/api/healthz")
            assert r.status_code == 200 and r.json()["ok"] is True
    run(main())


def test_gate_blocks_m_and_auth_until_passcode(app, upstream):
    upstream.json("GET", r"/api/_health", {"status": "ok"})

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/m/_health", headers=session_cookie_header())
            assert r.status_code == 401 and r.json()["error"]["code"] == "gate"
            r = await ac.post("/auth/gate", json={"passcode": "wrong"})
            assert r.status_code == 401
            r = await ac.post("/auth/gate", json={"passcode": "pw123"})
            assert r.status_code == 200
            gate = r.headers["set-cookie"].split(";")[0]
            r = await ac.get("/m/_health", headers={"Cookie": f"{gate}; {session_cookie_header()['Cookie']}"})
            assert r.status_code == 200
    run(main())


def test_gate_disabled_when_no_passcode_configured(upstream):
    from app.main import create_app
    from conftest import make_config
    app = create_app(make_config(client_access_passcode=None), upstream_transport=upstream.transport)
    upstream.json("GET", r"/api/_health", {"status": "ok"})

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/m/_health", headers=session_cookie_header())
            assert r.status_code == 200
    run(main())


def test_health_proxied_through_allowlist(app, upstream):
    upstream.json("GET", r"/api/_health", {"status": "ok", "version": "1.0"})

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/m/_health", headers=both_cookies())
            assert r.status_code == 200
            body = r.json()
            assert body["data"] == {"status": "ok", "version": "1.0"}
            assert upstream.requests[0].headers["Authorization"] == "Bearer jwt-1"
    run(main())


def test_out_of_scope_paths_denied(app):
    async def main():
        async with await asgi_client(app) as ac:
            for method, path in [
                ("GET", "/m/v1/app/msg/session"),
                ("GET", "/m/v1/admin/users"),
                ("POST", "/m/auth/login"),
                ("POST", "/m/users-permissions/update-email/send-otp"),
                ("GET", "/m/v1/app/feed/refresh"),  # not in the spec at all
            ]:
                r = await ac.request(method, path, headers=both_cookies())
                assert r.status_code == 404, f"{method} {path} should be denied"
                assert r.json()["error"]["code"] == "not_allowlisted"
    run(main())


def test_wrong_method_on_allowlisted_path_denied(app):
    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.request("PUT", "/m/v1/app/feed", headers=both_cookies())
            assert r.status_code == 404
    run(main())


def test_query_params_and_post_body_forwarded(app, upstream):
    captured = {}

    def feed(req: httpx.Request) -> httpx.Response:
        captured["page"] = req.url.params.get("page")
        return httpx.Response(200, json={"timeline": [], "meta": {"pagination": {"page": int(captured["page"])}}})

    def comment(req: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(req.content)
        return httpx.Response(200, json={"success": True, "payload": {"public_id": "c1", **captured["body"]}})

    upstream.add("GET", r"/api/v1/app/feed", feed)
    upstream.add("POST", r"/api/v1/app/comments", comment)

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/m/v1/app/feed?page=2&limit=20", headers=both_cookies())
            assert r.status_code == 200
            assert r.json()["meta"]["pagination"]["page"] == 2
            r = await ac.post("/m/v1/app/comments", json={"post_id": "p1", "comment": "hi"}, headers=both_cookies())
            assert r.status_code == 200
            assert r.json()["data"]["comment"] == "hi"
    run(main())
    assert captured["page"] == "2"
    assert captured["body"] == {"post_id": "p1", "comment": "hi"}


def test_upstream_error_status_propagated(app, upstream):
    upstream.json("GET", r"/api/v1/app/post/missing", {"error": {"message": "post not found", "code": "NOT_FOUND"}}, status=404)

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/m/v1/app/post/missing", headers=both_cookies())
            assert r.status_code == 404
            assert r.json()["error"]["message"] == "post not found"
    run(main())


def test_success_false_on_200_mapped_to_error(app, upstream):
    upstream.json("POST", r"/api/v1/app/posts/p1/like", {"success": False, "message": "already liked"})

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.post("/m/v1/app/posts/p1/like", headers=both_cookies())
            assert r.status_code == 502
            assert r.json()["error"]["message"] == "already liked"
    run(main())


def test_no_session_cookie_is_401(app):
    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/m/v1/app/feed", headers=gate_cookie_header())
            assert r.status_code == 401
            assert r.json()["error"]["code"] == "no_session"
    run(main())


def test_tampered_session_cookie_is_401(app):
    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/m/v1/app/feed", headers={"Cookie": "monnett_session=tampered"})
            assert r.status_code == 401
    run(main())


def test_phase2_write_endpoints_allowlisted(app, upstream):
    """Every Phase 2 write/read endpoint must pass the allowlist and forward."""
    import json as _json

    upstream.add("POST", r"/api/v1/app/posts/[^/]+/like", lambda req: httpx.Response(200, json={"success": True, "payload": {"liked": True, "likeCount": 5}}))
    upstream.add("DELETE", r"/api/v1/app/posts/[^/]+/like", lambda req: httpx.Response(200, json={"success": True, "payload": {"liked": False, "likeCount": 4}}))
    upstream.add("POST", r"/api/v1/app/comments", lambda req: httpx.Response(200, json={"success": True, "payload": {"public_id": "c9", **_json.loads(req.content)}}))
    upstream.add("DELETE", r"/api/v1/app/comments/[^/]+", lambda req: httpx.Response(200, json={"success": True, "payload": None}))
    upstream.add("GET", r"/api/v1/app/comments/[^/]+/replies", lambda req: httpx.Response(200, json={"success": True, "payload": {"replies": [], "meta": {"pagination": {"page": 1}}}}))
    upstream.add("POST", r"/api/v1/app/users/[^/]+/follow", lambda req: httpx.Response(200, json={"success": True, "payload": {"following": True, "followerCount": 13, "followingCount": 34}}))
    upstream.add("DELETE", r"/api/v1/app/users/[^/]+/follow", lambda req: httpx.Response(200, json={"success": True, "payload": {"following": False, "followerCount": 12, "followingCount": 34}}))
    upstream.add("GET", r"/api/search", lambda req: httpx.Response(200, json={"users": [{"id": 8, "username": "bob"}], "meta": {"pagination": {"page": 1}}}))
    upstream.add("GET", r"/api/v1/app/search/posts-by-tag", lambda req: httpx.Response(200, json={"posts": [], "meta": {"pagination": {"page": 1}}}))

    async def main():
        async with await asgi_client(app) as ac:
            h = both_cookies()
            checks = [
                ("POST", "/m/v1/app/posts/p1/like", None, 200),
                ("DELETE", "/m/v1/app/posts/p1/like", None, 200),
                ("POST", "/m/v1/app/comments", {"post_id": "p1", "comment": "hi"}, 200),
                ("DELETE", "/m/v1/app/comments/c1", None, 200),
                ("GET", "/m/v1/app/comments/c1/replies?page=1", None, 200),
                ("POST", "/m/v1/app/users/uuid-1/follow", None, 200),
                ("DELETE", "/m/v1/app/users/uuid-1/follow", None, 200),
                ("GET", "/m/search?keyword=bob&type=user", None, 200),
                ("GET", "/m/v1/app/search/posts-by-tag?tag=art", None, 200),
            ]
            for method, path, body, want in checks:
                r = await ac.request(method, path, json=body, headers=h)
                assert r.status_code == want, f"{method} {path} -> {r.status_code}"
    run(main())


def test_rate_limit_guardrail(upstream):
    from app.main import create_app
    from conftest import make_config
    upstream.json("GET", r"/api/_health", {"ok": True})
    app = create_app(make_config(rate_limit_per_minute=5), upstream_transport=upstream.transport)

    async def main():
        async with await asgi_client(app) as ac:
            codes = [ (await ac.get("/m/_health", headers=both_cookies())).status_code for _ in range(7) ]
            assert codes[:5] == [200] * 5
            assert codes[5:] == [429, 429]
    run(main())
