"""Phase 3 feature flags: /api/features + proxy enforcement."""
import httpx

from app.main import create_app
from conftest import asgi_client, gate_cookie_header, make_config, merge_cookies, run, session_cookie_header


def test_features_endpoint_reports_flags(app):
    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/api/features", headers=gate_cookie_header())
            assert r.status_code == 200
            assert r.json() == {"createPost": True, "notifications": True, "stories": True, "discover": True}
    run(main())


def test_disabled_feature_is_404_but_others_work(upstream):
    upstream.json("GET", r"/api/v1/app/feed", {"timeline": [], "meta": {"pagination": {"page": 1}}})
    upstream.json("GET", r"/api/notification-count", {"count": 0})
    cfg = make_config(enable_notifications=False, enable_stories=False)
    app = create_app(cfg, upstream_transport=upstream.transport)

    async def main():
        async with await asgi_client(app) as ac:
            h = merge_cookies(gate_cookie_header(), session_cookie_header())
            r = await ac.get("/api/features", headers=gate_cookie_header())
            assert r.json()["notifications"] is False and r.json()["stories"] is False
            r = await ac.get("/m/notification-count", headers=h)
            assert r.status_code == 404 and r.json()["error"]["code"] == "feature_disabled"
            r = await ac.get("/m/v1/app/stories", headers=h)
            assert r.status_code == 404
            r = await ac.get("/m/v1/app/users/u1/stories", headers=h)
            assert r.status_code == 404
            # unrelated endpoints unaffected (follow is NOT stories-gated)
            r = await ac.get("/m/v1/app/feed", headers=h)
            assert r.status_code == 200
    run(main())


def test_create_post_flag_gates_both_create_and_upload(upstream):
    cfg = make_config(enable_create_post=False)
    app = create_app(cfg, upstream_transport=upstream.transport)

    async def main():
        async with await asgi_client(app) as ac:
            h = merge_cookies(gate_cookie_header(), session_cookie_header())
            r = await ac.post("/m/v1/app/post/create", json={"post_type": "POST", "description": "x"}, headers=h)
            assert r.status_code == 404
            r = await ac.post("/m/v1/app/media/upload", headers=h)
            assert r.status_code == 404
    run(main())


def test_users_stories_allowlisted_when_stories_enabled(app, upstream):
    upstream.json("GET", r"/api/v1/app/users/[^/]+/stories", {"stories": []})
    upstream.json("GET", r"/api/v1/app/users/[^/]+/stories/months", {"months": []})
    upstream.json("GET", r"/api/v1/app/users/[^/]+/stories/months/[^/]+", {"stories": []})
    upstream.json("GET", r"/api/v1/app/stories/[^/]+/viewers", {"viewers": []})
    upstream.add("DELETE", r"/api/v1/app/post/[^/]+", lambda req: httpx.Response(200, json={"success": True}))

    async def main():
        async with await asgi_client(app) as ac:
            h = merge_cookies(gate_cookie_header(), session_cookie_header())
            for path in [
                "/m/v1/app/users/uuid-9/stories",
                "/m/v1/app/users/uuid-9/stories/months",
                "/m/v1/app/users/uuid-9/stories/months/2026-11",
                "/m/v1/app/stories/s1/viewers",
            ]:
                r = await ac.get(path, headers=h)
                assert r.status_code == 200, path
            r = await ac.delete("/m/v1/app/post/uuid-9", headers=h)
            assert r.status_code == 200
    run(main())
