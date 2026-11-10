"""Login / session / logout flow against the mock upstream."""
import httpx

from conftest import asgi_client, gate_cookie_header, merge_cookies, run, session_cookie_header
from app import session as sess
from conftest import TEST_SECRET


def mock_login(upstream, jwt="jwt-1", refresh="r-1", user=None):
    upstream.json("POST", r"/api/auth/login", {
        "success": True, "code": "OK",
        "payload": {"jwt": jwt, "refresh_token": refresh, "user": user or {"id": 7, "username": "testuser"}},
    })
    upstream.json("GET", r"/api/user", user or {"id": 7, "username": "testuser", "publicId": "pub-7"})


def cookie_from_response(r, name) -> str:
    for part in r.headers.get_list("set-cookie"):
        if part.startswith(f"{name}="):
            return part.split(";")[0]
    raise AssertionError(f"no {name} cookie in response")


def test_login_sets_encrypted_session_cookie_and_hydrates_user(app, upstream):
    mock_login(upstream)

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.post("/auth/login", json={"email": "a@b.c", "password": "pw"}, headers=gate_cookie_header())
            assert r.status_code == 200
            assert r.json()["data"]["username"] == "testuser"
            cookie = cookie_from_response(r, sess.SESSION_COOKIE)
            assert "HttpOnly" in r.headers.get_list("set-cookie")[0]
            raw = cookie.split("=", 1)[1]
            assert "jwt-1" not in raw  # encrypted
            data = sess.unseal_session(TEST_SECRET, raw)
            assert data.access_token == "jwt-1" and data.refresh_token == "r-1"
            # login request body hit upstream correctly
            login_req = next(q for q in upstream.requests if q.url.path == "/api/auth/login")
            import json as _json
            assert _json.loads(login_req.content) == {"email": "a@b.c", "password": "pw"}
            return cookie
    run(main())


def test_login_bad_credentials_returns_401(app, upstream):
    upstream.json("POST", r"/api/auth/login", {"error": {"message": "invalid credentials", "code": "BAD_CREDENTIALS"}}, status=401)

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.post("/auth/login", json={"email": "a@b.c", "password": "wrong"}, headers=gate_cookie_header())
            assert r.status_code == 401
            assert r.json()["error"]["message"] == "invalid credentials"
    run(main())


def test_session_endpoint_hydrates_user(app, upstream):
    upstream.json("GET", r"/api/user", {"id": 7, "username": "testuser"})

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/auth/session", headers=merge_cookies(gate_cookie_header(), session_cookie_header()))
            assert r.status_code == 200
            assert r.json()["data"]["id"] == 7
    run(main())


def test_session_without_cookie_is_401(app):
    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/auth/session", headers=gate_cookie_header())
            assert r.status_code == 401
    run(main())


def test_logout_clears_cookie_and_calls_upstream(app, upstream):
    upstream.json("POST", r"/api/logout", {"success": True})

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.post("/auth/logout", headers=merge_cookies(gate_cookie_header(), session_cookie_header()))
            assert r.status_code == 200
            set_cookies = r.headers.get_list("set-cookie")
            assert any(c.startswith(f"{sess.SESSION_COOKIE}=") and ("Max-Age=0" in c or "1970" in c) for c in set_cookies)
            assert upstream.count("POST", r"/api/logout") == 1
    run(main())


def test_session_refresh_failure_clears_cookie(app, upstream):
    """If the refresh token is rejected upstream, /auth/session must 401 and
    clear the session cookie (explicit refresh-error logout, PLAN.md §7)."""
    upstream.add("GET", r"/api/user", lambda req: httpx.Response(401, json={"error": {"message": "expired"}}))
    upstream.json("POST", r"/api/refresh", {"error": {"message": "revoked"}}, status=401)

    async def main():
        async with await asgi_client(app) as ac:
            r = await ac.get("/auth/session", headers=merge_cookies(gate_cookie_header(), session_cookie_header()))
            assert r.status_code == 401
            assert r.json()["error"]["code"] == "refresh_failed"
            assert any(c.startswith(f"{sess.SESSION_COOKIE}=") for c in r.headers.get_list("set-cookie"))
            assert upstream.count("POST", r"/api/refresh") == 1
    run(main())
