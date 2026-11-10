# monyett-web

A personal, single-account, self-hosted web client for [Monnett](https://monnett.social) — Python (FastAPI) backend proxy + React (Vite/TypeScript) frontend. Built strictly from the official OpenAPI spec (`api.monnettsocial.com/openapi.json`); snapshots live in `docs/`.

> **Unofficial client.** The Monnett API is unsupported and may break without notice. Personal, human-paced use only — no automation, polling loops, or scraping.

## Features

Sign in → chronological feed (background new-post check with a manual "-- refresh --") → post detail with threaded comments → profiles → like / comment / follow / search (users + hashtags) → create media-first posts (multi photo/video, audience, location, phone-frame preview) → notifications → discover (global/country/city/nearby). Monnett brand styling, member badges, avatar rings, hashtag links, photo lightbox with cursor zoom.

**Stories**: circles above the feed (your story first, "+" to add; pink ring = unseen), tap-through viewer with progress bars, auto-advance, hold-to-pause and tap zones; create stories from the compose page (`/compose?type=story`, `post_type: "STORY"` + media upload); on your own stories you can see viewers and delete them; story archive by month on your own profile. Read-mostly: only "mark viewed" is automatic; everything else is an explicit action.

Out of scope by design: E2EE DMs, push notifications, registration/deletion, payments, admin.

## Security & hardening

Passcode gate (optional) in front of everything · JWT+refresh only in a Fernet-encrypted HttpOnly cookie (never in JS/logs) · `/m/*` allowlist of official endpoints only · 60 req/min proxy limit with `Retry-After` + full-screen countdown UI on 429 · stricter 10/min limit on login/gate · 25MB upload cap · CSP/nosniff/DENY/referrer headers · HSTS on HTTPS · `no-store` for index.html · in-app "About this client" notice (unofficial, personal use, API may break).

## Architecture

```
Browser (React SPA) ── same-origin ──► FastAPI BFF ──► Monnett REST API
         │  /auth/*, /m/* (allowlist)      │  JWT+refresh in a Fernet-encrypted
         │  HttpOnly cookies               │  HttpOnly cookie, single-flight refresh
```

- Tokens never touch JavaScript; all API quirks (envelope, refresh body, UUID vs numeric IDs) live in `backend/app/monnett_client.py`.
- `/m/*` is an **allowlist** of official endpoints only, with a rate-limit guardrail; media loads directly from CDN URLs.
- Optional passcode gate (`CLIENT_ACCESS_PASSCODE`) in front of everything.
- No database — session state is only the encrypted cookie.

## Setup

Requirements: Python 3.12+, Node 20+.

```bash
# backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# frontend
cd ../frontend
npm install
npm run build          # FastAPI serves frontend/dist
```

Run (production account):

```bash
cd backend
MONNETT_API_BASE=https://api.monnettsocial.com \
SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')" \
CLIENT_ACCESS_PASSCODE="choose-a-passcode" \
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` → enter passcode → sign in with your Monnett credentials. On a VPS, put it behind HTTPS (the `Secure` cookie flag turns on automatically via `X-Forwarded-Proto`).

### Env vars

| Var | Default | Purpose |
|---|---|---|
| `MONNETT_API_BASE` | `https://api-dev.monnettsocial.com` | upstream host |
| `SESSION_SECRET` | ephemeral (warns) | Fernet key for the session cookie — set a fixed value |
| `CLIENT_ACCESS_PASSCODE` | unset = gate off | access gate |
| `RATE_LIMIT_PER_MINUTE` | `60` | `/m/*` guardrail |
| `COOKIE_SECURE` | auto | force Secure flag on/off |
| `ENABLE_CREATE_POST` / `ENABLE_NOTIFICATIONS` / `ENABLE_STORIES` / `ENABLE_DISCOVER` | `true` | feature flags |

### Dev without an account

```bash
cd backend
.venv/bin/python dev/mock_upstream.py &   # mock API on :9999
MONNETT_API_BASE=http://127.0.0.1:9999 SESSION_SECRET=dev CLIENT_ACCESS_PASSCODE=dev \
  .venv/bin/uvicorn app.main:app --port 8000
# log in with any email + password "pw"
```

Frontend dev mode (hot reload, proxies to :8000): `cd frontend && npm run dev` → http://localhost:5173

## Tests

```bash
cd backend && .venv/bin/python -m pytest        # 49 mock-only unit tests (never hits Monnett)
cd frontend && npm run build                     # typecheck + build
```

CI (GitHub Actions) runs both on every push/PR.

## Layout

```
backend/app/    main.py (routes, allowlist proxy, gate, rate limits) · monnett_client.py (all API quirks)
                config.py · session.py (encrypted cookies) · schemas.py · dev/mock_upstream.py
frontend/src/   api.ts · hooks.ts · pages/ (Feed, PostDetail, Profile, Search, Compose, …) · components/
docs/           openapi-prod.json / openapi-dev.json (contract of record)
AGENTS.md       working conventions for agents on this repo
```
