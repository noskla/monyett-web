"""The single module that owns every Monnett API quirk (PLAN.md §2, §5).

Quirks handled here and nowhere else:
- All upstream paths carry the /api prefix; the base URL is the bare host.
- POST /api/refresh expects the refresh token as a bare JSON *string* body,
  not an object (OpenAPI: requestBody schema {"type": "string"}).
- Envelope: {success, code, message, payload|data, meta}. `success: false` is
  an error even on HTTP 200. Unwrap order: payload, then data, then the raw
  object. Pagination meta may sit at top level or inside the payload.
- A 401 triggers a single-flight refresh followed by exactly one retry.
- No automatic retries on writes or after network errors/429/5xx; only the
  explicit 401 -> refresh -> retry path (PLAN.md §5).
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any

import httpx


class MonnettApiError(Exception):
    """Normalized upstream error: one shape for the whole app."""

    def __init__(self, status: int, message: str, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


class RefreshFailed(MonnettApiError):
    """Refresh token rejected/expired -> session must be cleared (logout)."""

    def __init__(self, message: str = "session refresh failed; log in again"):
        super().__init__(401, message, "refresh_failed")


@dataclass
class ApiResult:
    data: Any
    meta: Any = None


def unwrap_envelope(body: Any) -> ApiResult:
    """Normalize any Monnett response shape into (data, meta)."""
    if not isinstance(body, dict):
        return ApiResult(data=body)
    if body.get("success") is False:
        raise MonnettApiError(
            200,
            str(body.get("message") or body.get("code") or "request failed"),
            body.get("code") if isinstance(body.get("code"), str) else None,
        )
    if "payload" in body:
        data = body["payload"]
    elif "data" in body:
        data = body["data"]
    else:
        data = body
    meta = body.get("meta")
    if meta is None and isinstance(data, dict):
        meta = data.get("meta")
    return ApiResult(data=data, meta=meta)


def _extract_message(body: Any) -> str:
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict):
            return str(err.get("message") or err.get("code") or "upstream error")
        for key in ("message", "detail", "error"):
            if body.get(key):
                return str(body[key])
    return "upstream error"


def _extract_code(body: Any) -> str | None:
    if isinstance(body, dict):
        code = body.get("code")
        if isinstance(code, str):
            return code
        err = body.get("error")
        if isinstance(err, dict) and isinstance(err.get("code"), str):
            return err["code"]
    return None


def extract_tokens(data: Any) -> tuple[str | None, str | None]:
    """Pull (access, refresh) tokens out of a login/refresh payload.

    The documented shape is the envelope payload AuthSession
    {jwt, refresh_token, user}; we also tolerate flat/alternate key names
    because login's 200 response is undocumented in the spec.
    """
    candidates = [data]
    if isinstance(data, dict):
        for key in ("payload", "data", "session"):
            if isinstance(data.get(key), dict):
                candidates.append(data[key])
    access = refresh = None
    for cand in candidates:
        if not isinstance(cand, dict):
            continue
        access = access or cand.get("jwt") or cand.get("access_token") or cand.get("accessToken") or cand.get("token")
        refresh = refresh or cand.get("refresh_token") or cand.get("refreshToken")
    return access, refresh


class MonnettClient:
    """Async client for one Monnett host. Shared per app; tokens seeded per request."""

    def __init__(self, base_url: str, transport: httpx.AsyncBaseTransport | None = None, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self._http = httpx.AsyncClient(base_url=self.base_url, transport=transport, timeout=timeout)
        self._access: str | None = None
        self._refresh: str | None = None
        self._lock = asyncio.Lock()
        self.refresh_count = 0  # observability for tests / logs (never log tokens)

    def set_tokens(self, access: str | None, refresh: str | None) -> None:
        self._access = access
        self._refresh = refresh

    @property
    def access_token(self) -> str | None:
        return self._access

    @property
    def refresh_token(self) -> str | None:
        return self._refresh

    async def close(self) -> None:
        await self._http.aclose()

    # -- auth -----------------------------------------------------------

    async def login(self, email: str, password: str) -> ApiResult:
        resp = await self._http.post("/api/auth/login", json={"email": email, "password": password})
        return self._handle(resp)

    async def logout(self) -> None:
        """Best-effort upstream logout; never raises."""
        try:
            await self._send("POST", "/api/logout")
        except Exception:
            pass

    async def refresh(self) -> None:
        """POST /api/refresh with the bare JSON-string body quirk.

        Raises RefreshFailed on any failure so the caller can log out.
        Handles refresh-token rotation (new refresh token replaces the old).
        """
        if not self._refresh:
            raise RefreshFailed("no refresh token")
        try:
            resp = await self._http.post(
                "/api/refresh",
                content=json.dumps(self._refresh),  # quirk: body is a JSON string
                headers={"Content-Type": "application/json"},
            )
            result = self._handle(resp)
        except MonnettApiError as exc:
            raise RefreshFailed(str(exc.message)) from exc
        access, new_refresh = extract_tokens(result.data)
        if not access:
            raise RefreshFailed("refresh response contained no token")
        self._access = access
        if new_refresh:
            self._refresh = new_refresh  # rotation
        self.refresh_count += 1

    # -- generic request -------------------------------------------------

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Any = None,
        json_body: Any = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> ApiResult:
        if not path.startswith("/api/"):
            path = "/api/" + path
        resp = await self._send(method, path, params=params, json_body=json_body, content=content, headers=headers)
        if resp.status_code == 401 and self._refresh:
            await self._single_flight_refresh(before=self._access)
            # exactly one retry after a successful refresh; never more
            resp = await self._send(method, path, params=params, json_body=json_body, content=content, headers=headers)
        return self._handle(resp)

    async def _send(self, method: str, path: str, *, params: Any = None, json_body: Any = None,
                    content: bytes | None = None, headers: dict[str, str] | None = None) -> httpx.Response:
        hdrs: dict[str, str] = {}
        if self._access:
            hdrs["Authorization"] = f"Bearer {self._access}"
        if headers:
            hdrs.update(headers)
        return await self._http.request(method, path, params=params, json=json_body, content=content, headers=hdrs)

    async def _single_flight_refresh(self, before: str | None) -> None:
        async with self._lock:
            if self._access != before:
                return  # a concurrent request already refreshed while we waited
            await self.refresh()

    def _handle(self, resp: httpx.Response) -> ApiResult:
        if resp.status_code >= 400:
            try:
                body = resp.json()
            except ValueError:
                body = None
            raise MonnettApiError(resp.status_code, _extract_message(body), _extract_code(body))
        try:
            body = resp.json()
        except ValueError:
            return ApiResult(data=resp.text)
        return unwrap_envelope(body)
