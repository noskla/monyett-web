"""GET /api/upstream-health: login-page probe of the Monnett environment."""
from conftest import asgi_client, gate_cookie_header, run


def test_upstream_health_ok(app, upstream):
    upstream.json("GET", r"/api/_health", {"status": "ok"})

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/api/upstream-health", headers=gate_cookie_header())
            assert r.status_code == 200
            assert r.json()["ok"] is True
            assert r.json()["data"] == {"status": "ok"}
            # no Authorization header should be sent without a session
            assert "authorization" not in upstream.requests[0].headers
    run(main())


def test_upstream_health_down(app, upstream):
    upstream.json("GET", r"/api/_health", {"error": {"message": "down for maintenance"}}, status=503)

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/api/upstream-health", headers=gate_cookie_header())
            assert r.status_code == 200
            assert r.json()["ok"] is False
            assert r.json()["error"] == "down for maintenance"
    run(main())
