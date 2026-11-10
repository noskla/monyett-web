"""FastAPI BFF proxy for Monnett (PLAN.md §1, §4 Phase 0).

Routes:
  GET  /api/healthz        backend liveness (never gated, never proxied)
  POST /auth/gate          passcode gate -> sets HttpOnly gate cookie
  POST /auth/login         email/password -> encrypted session cookie
  POST /auth/logout        best-effort upstream logout, clears cookies
  GET  /auth/session       hydrate current user from upstream /api/user
  *    /m/{path}           allowlisted passthrough to {MONNETT_API_BASE}/api/{path}

The /m/* surface is an ALLOWLIST of (method, path pattern) pairs from
PLAN.md §2 — not a catch-all — plus a denylist backstop, so out-of-scope
upstream areas (msg/Matrix, admin, fcm, otp, account changes) can never be
reached through the proxy.
"""
from __future__ import annotations

import logging
import re
import time
from collections import defaultdict, deque
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from . import session as sess
from .config import Config
from .monnett_client import MonnettApiError, MonnettClient, RefreshFailed, extract_tokens
from .schemas import GateRequest, LoginRequest

log = logging.getLogger("monnett.http")

# --- /m/* allowlist: the endpoint map from PLAN.md §2 (method, path regex) ---
_ID = r"[^/]+"
_ALLOWED: list[tuple[str, re.Pattern[str]]] = [
    ("GET", re.compile(rf"^/api/_health$")),
    ("GET", re.compile(rf"^/api/user$")),
    ("GET", re.compile(rf"^/api/v1/app/feed$")),
    ("GET", re.compile(rf"^/api/v1/app/feed/discover$")),
    ("GET", re.compile(rf"^/api/v1/app/post/{_ID}$")),
    ("POST", re.compile(rf"^/api/v1/app/post/create$")),
    ("GET", re.compile(rf"^/api/v1/app/posts/{_ID}/comments$")),
    ("POST", re.compile(rf"^/api/v1/app/posts/{_ID}/like$")),
    ("DELETE", re.compile(rf"^/api/v1/app/posts/{_ID}/like$")),
    ("GET", re.compile(rf"^/api/v1/app/posts/{_ID}/likes$")),
    ("GET", re.compile(rf"^/api/v1/app/comments/{_ID}/replies$")),
    ("POST", re.compile(rf"^/api/v1/app/comments$")),
    ("DELETE", re.compile(rf"^/api/v1/app/comments/{_ID}$")),
    ("GET", re.compile(rf"^/api/v1/app/user/by-username/{_ID}$")),
    ("GET", re.compile(rf"^/api/profile/{_ID}$")),
    ("GET", re.compile(rf"^/api/users/{_ID}/posts$")),
    ("GET", re.compile(rf"^/api/v1/app/users/{_ID}/relations$")),
    ("POST", re.compile(rf"^/api/v1/app/users/{_ID}/follow$")),
    ("DELETE", re.compile(rf"^/api/v1/app/users/{_ID}/follow$")),
    ("GET", re.compile(rf"^/api/search$")),
    ("GET", re.compile(rf"^/api/v1/app/search/posts-by-tag$")),
    ("GET", re.compile(rf"^/api/notification$")),
    ("GET", re.compile(rf"^/api/notification-count$")),
    ("POST", re.compile(rf"^/api/notification/seen/{_ID}$")),
    ("POST", re.compile(rf"^/api/notification/mark-all-seen$")),
    ("GET", re.compile(rf"^/api/v1/app/stories$")),
    ("POST", re.compile(rf"^/api/v1/app/stories/{_ID}/view$")),
    ("POST", re.compile(rf"^/api/v1/app/media/upload$")),
]

# Backstop: even if a pattern above ever matches something sensitive, these
# substrings are always refused. /api/auth/* is handled by /auth/* here, never proxied.
_DENY_SUBSTRINGS = ("/msg/", "/admin/", "/webhook", "/fcm", "/otp", "/matrix", "/users-permissions", "/api/auth/")

GATE_EXEMPT_PATHS = {"/api/healthz", "/auth/gate"}

DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

GATE_PAGE_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Monnett — web (unofficial)</title>
<style>body{font-family:system-ui,sans-serif;background:#161922;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}form{display:flex;flex-direction:column;gap:.75rem;width:260px;align-items:center}input,button{padding:.6rem .8rem;border-radius:8px;border:1px solid #2b3040;background:#1e2230;color:inherit;width:100%;box-sizing:border-box}button{background:#ff384f;border:none;cursor:pointer}button:hover{background:#f5405e}.err{color:#ff7b7b;font-size:.85rem}</style>
</head><body><form id="f"><svg viewBox="0 0 749 749" width="44" height="44" aria-hidden="true"><path d="M124.856,0.722l498.879,0c68.725,0 124.438,55.712 124.438,124.438l0,498.879c0,68.725 -55.713,124.438 -124.438,124.438l-498.879,0c-68.725,0 -124.438,-55.713 -124.438,-124.438l0,-498.879c0,-68.725 55.712,-124.438 124.438,-124.438Z" fill="#ff384f"/></svg><input id="p" type="password" placeholder="passcode" autocomplete="current-password"><button>Unlock</button><div class="err" id="e"></div></form>
<script>document.getElementById('f').onsubmit=async ev=>{ev.preventDefault();const r=await fetch('/auth/gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode:document.getElementById('p').value})});if(r.ok)location.reload();else document.getElementById('e').textContent='wrong passcode';};</script>
</body></html>"""


def is_allowed(method: str, path: str) -> bool:
    if any(s in path for s in _DENY_SUBSTRINGS):
        return False
    return any(m == method and p.match(path) for m, p in _ALLOWED)


def _secure_flag(config: Config, request: Request) -> bool:
    if config.cookie_secure is not None:
        return config.cookie_secure
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def _set_session_cookie(config: Config, request: Request, response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        sess.SESSION_COOKIE,
        sess.seal_session(config.session_secret, sess.SessionData(access, refresh)),
        max_age=sess.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=_secure_flag(config, request),
        path="/",
    )


_active_config: Config | None = None  # set in create_app; used by cookie helpers


def _clear_cookie(request: Request, response: Response, name: str) -> None:
    assert _active_config is not None
    response.set_cookie(name, "", max_age=0, httponly=True, samesite="lax",
                        secure=_secure_flag(_active_config, request), path="/")


def create_app(config: Config, upstream_transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    global _active_config
    _active_config = config
    app = FastAPI(title="monyett-web BFF", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.monnett = MonnettClient(config.monnett_api_base, transport=upstream_transport)
    windows: dict[str, deque[float]] = defaultdict(deque)

    # -- middleware: gate, security headers, redacted request logging --------

    @app.middleware("http")
    async def gate_and_headers(request: Request, call_next):
        path = request.url.path
        if config.client_access_passcode and path not in GATE_EXEMPT_PATHS:
            token = request.cookies.get(sess.GATE_COOKIE)
            if not sess.unseal_gate(config.session_secret, token):
                if path.startswith(("/m/", "/auth/")):
                    return JSONResponse({"error": {"status": 401, "message": "passcode required", "code": "gate"}}, status_code=401)
                return HTMLResponse(GATE_PAGE_HTML, status_code=401)
        started = time.monotonic()
        response = await call_next(request)
        # Security headers (tokens never leave this origin; media loads from CDN)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' https: data:; media-src 'self' https:; "
            "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"
        )
        # Request logging with token fields redacted: method/path/status/duration only.
        log.info("%s %s -> %s (%.0fms)", request.method, path, response.status_code, (time.monotonic() - started) * 1000)
        return response

    async def rate_limit(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        dq = windows[ip]
        while dq and now - dq[0] > 60:
            dq.popleft()
        if len(dq) >= config.rate_limit_per_minute:
            raise HTTPException(status_code=429, detail="rate limit exceeded")
        dq.append(now)

    def client_from_request(request: Request) -> tuple[bool, sess.SessionData | None]:
        data = sess.unseal_session(config.session_secret, request.cookies.get(sess.SESSION_COOKIE))
        if data:
            app.state.monnett.set_tokens(data.access_token, data.refresh_token)
        return (data is not None), data

    # -- backend-own routes ---------------------------------------------------

    @app.get("/api/healthz")
    async def healthz() -> dict:
        return {"ok": True, "environment": config.environment}

    @app.get("/api/upstream-health")
    async def upstream_health() -> JSONResponse:
        """Unauthenticated probe of the Monnett environment (login-page banner)."""
        try:
            result = await app.state.monnett.request("GET", "/api/_health")
            return JSONResponse({"ok": True, "data": result.data})
        except MonnettApiError as exc:
            return JSONResponse({"ok": False, "error": exc.message})

    @app.post("/auth/gate")
    async def gate(body: GateRequest, request: Request, response: Response) -> JSONResponse:
        if not config.client_access_passcode or body.passcode != config.client_access_passcode:
            return JSONResponse({"error": {"status": 401, "message": "invalid passcode", "code": "gate"}}, status_code=401)
        out = JSONResponse({"ok": True})
        out.set_cookie(sess.GATE_COOKIE, sess.seal_gate(config.session_secret), max_age=sess.GATE_MAX_AGE,
                       httponly=True, samesite="lax", secure=_secure_flag(config, request), path="/")
        return out

    @app.post("/auth/login")
    async def login(body: LoginRequest, request: Request, response: Response) -> JSONResponse:
        client = app.state.monnett
        try:
            result = await client.login(body.email, body.password)
        except MonnettApiError as exc:
            status = 401 if exc.status in (400, 401, 403) else exc.status
            return JSONResponse({"error": {"status": exc.status, "message": exc.message, "code": exc.code}}, status_code=status)
        access, refresh = extract_tokens(result.data)
        if not access or not refresh:
            return JSONResponse({"error": {"status": 502, "message": "login response contained no tokens", "code": "no_tokens"}}, status_code=502)
        client.set_tokens(access, refresh)
        user = None
        try:
            user = (await client.request("GET", "/api/user")).data
        except MonnettApiError as exc:
            log.info("login ok but /api/user hydration failed: %s", exc.message)
        out = JSONResponse({"data": user if user is not None else result.data})
        _set_session_cookie(config, request, out, access, refresh)
        return out

    @app.post("/auth/logout")
    async def logout(request: Request, response: Response) -> JSONResponse:
        ok, data = client_from_request(request)
        if ok and data:
            await app.state.monnett.logout()
        out = JSONResponse({"ok": True})
        _clear_cookie(request, out, sess.SESSION_COOKIE)
        return out

    @app.get("/auth/session")
    async def session(request: Request, response: Response) -> JSONResponse:
        ok, data = client_from_request(request)
        if not ok or not data:
            return JSONResponse({"error": {"status": 401, "message": "no session", "code": "no_session"}}, status_code=401)
        try:
            result = await app.state.monnett.request("GET", "/api/user")
        except RefreshFailed as exc:
            out = JSONResponse({"error": {"status": 401, "message": exc.message, "code": exc.code}}, status_code=401)
            _clear_cookie(request, out, sess.SESSION_COOKIE)
            return out
        except MonnettApiError as exc:
            return JSONResponse({"error": {"status": exc.status, "message": exc.message, "code": exc.code}}, status_code=502)
        # persist rotated tokens, if any
        out = JSONResponse({"data": result.data, "meta": result.meta})
        if app.state.monnett.access_token and (
            app.state.monnett.access_token != data.access_token
            or app.state.monnett.refresh_token != data.refresh_token
        ):
            _set_session_cookie(config, request, out, app.state.monnett.access_token, app.state.monnett.refresh_token or data.refresh_token)
        return out

    # -- allowlisted passthrough ----------------------------------------------

    @app.api_route("/m/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def proxy(path: str, request: Request, response: Response, _: None = Depends(rate_limit)) -> Response:
        upstream_path = "/api/" + path
        if not is_allowed(request.method, upstream_path):
            return JSONResponse({"error": {"status": 404, "message": "endpoint not allowlisted", "code": "not_allowlisted"}}, status_code=404)
        ok, data = client_from_request(request)
        if not ok or not data:
            return JSONResponse({"error": {"status": 401, "message": "no session", "code": "no_session"}}, status_code=401)
        client = app.state.monnett
        before = (client.access_token, client.refresh_token)
        body = await request.body()
        headers = {"Content-Type": request.headers["content-type"]} if body and request.headers.get("content-type") else None
        try:
            result = await client.request(
                request.method,
                upstream_path,
                params=request.query_params,
                content=body if body else None,
                headers=headers,
            )
        except RefreshFailed as exc:
            out = JSONResponse({"error": {"status": 401, "message": exc.message, "code": exc.code}}, status_code=401)
            _clear_cookie(request, out, sess.SESSION_COOKIE)
            return out
        except MonnettApiError as exc:
            status = exc.status if exc.status >= 400 else 502  # success:false on HTTP 200 -> 502
            return JSONResponse({"error": {"status": exc.status, "message": exc.message, "code": exc.code}}, status_code=status)
        out = JSONResponse({"data": result.data, "meta": result.meta})
        if client.access_token and (client.access_token, client.refresh_token) != before:
            _set_session_cookie(config, request, out, client.access_token, client.refresh_token or data.refresh_token)
        return out

    # -- SPA (served only behind the gate when a passcode is configured) ------

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> Response:
        if DIST_DIR.is_dir():
            candidate = DIST_DIR / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            index = DIST_DIR / "index.html"
            if index.is_file():
                return FileResponse(index)
        return HTMLResponse(
            "<h1>monyett-web backend</h1><p>Frontend not built yet. "
            "Run <code>npm run build</code> in frontend/ (Phase 1+).</p>"
        )

    return app


app = create_app(Config.from_env())
