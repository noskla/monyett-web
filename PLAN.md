# PLAN.md — Minimal Monnett Web Client (Python + React)

> Implementation plan for an autonomous agent (Vibe) to build a personal, low-risk web client for Monnett (monnett.social). Written so the agent can execute it phase by phase without making product, legal, or architectural decisions on its own. Save/export this document as `PLAN.md` in the repo root before starting.

---

## 0. Purpose, Constraints & Risk Principles

**Goal.** A single-user, self-hosted web client for Monnett covering the core social loop: sign in → browse the chronological feed → open profiles and posts → like and comment. Python (FastAPI) backend + React frontend.

**Hard constraints (do not deviate):**

1. **Use only the official OpenAPI specification** — production: `https://api.monnettsocial.com/openapi.json`, development: `https://api-dev.monnettsocial.com/openapi.json`. Do **not** reverse engineer the Android app; it is unnecessary (the spec plus the endpoint map below suffices) and adds legal risk.
2. **Prefer the modern `/api/v1/app/...` endpoints** over legacy routes (`/api/like`, `/api/comment`, `/api/follow`, …). The v1 family uses idempotent `POST`/`DELETE` semantics for like/follow/block/pin; legacy routes are toggles and deprecated paths with duplicates.
3. **No database.** No persistence beyond an encrypted session cookie. This is a personal client for one Monnett account.
4. **Out of scope entirely (do not attempt):** end-to-end encrypted DMs (Matrix), push notifications (FCM), membership purchase, account registration/deletion, media transcoding, scraping or bulk data collection.
5. **ToS caution.** Monnett's Terms of Use prohibit misusing/exploiting the service without permission. This client is for **personal, single-account, human-paced use only**. No automated polling loops faster than a user-triggered refresh. Recommended (not blocking): email `welcome@monnet.social` stating you built a personal web client from the published OpenAPI spec.

**Risk principles, in priority order:** read-only before write actions; known endpoints over discovered ones; one thin layer that owns all Monnett API quirks; snapshot the API contract; test against the dev environment before touching production.

---

## 1. Architecture (deliberately boring)

```
Browser (React SPA, Vite)
    │  fetch /api/... (same origin, HttpOnly session cookie)
    ▼
FastAPI backend ("BFF proxy")          api-dev / api.monnettsocial.com
  ├─ /auth/login, /auth/logout         │
  ├─ session store (encrypted cookie) │  Authorization: Bearer <JWT>
  ├─ single-flight token refresh       ├──────────────────────────►
  └─ /m/* catch-all passthrough        │  GET/POST /api/v1/app/...
                                      ▼
                              Monnett REST API (OpenAPI 3.1)
                              Media loaded directly from CDN URLs
                              returned in payloads (no proxying)
```

**Why a Python backend proxy at all (instead of React → Monnett directly):**

- The browser cannot call `api.monnettsocial.com` directly (CORS), and exposing JWT/refresh tokens to JavaScript is the single biggest security risk in this design.
- All Monnett API quirks (refresh-body-is-a-JSON-string, `success/payload/data` envelope, 200-with-`success:false` errors) live in **one module**, so upstream changes break one file, not the app.
- Token refresh is centralized; concurrent 401s trigger exactly one refresh (single-flight).

**Stack (fixed; do not substitute):**

- Backend: Python 3.12+, FastAPI, `httpx` (async client), `uvicorn`. Token encryption: `itsdangerous` or `cryptography` Fernet. No ORM, no DB driver.
- Frontend: Vite + React + TypeScript. Only `react-router-dom` as an extra dependency. Plain CSS (no UI framework, no state library beyond React built-ins; server state via a tiny `useApi` hook + manual refetch).
- Config via environment variables: `MONNETT_API_BASE` (default dev), `SESSION_SECRET`, `CLIENT_ACCESS_PASSCODE` (simple gate so the app isn't open to the LAN; any non-empty value enables it).

---

## 2. Verified API Facts (build exactly against these)

Facts confirmed from the live production OpenAPI spec (fetched 10 Nov 2026) and the endpoint map below. Treat this section as the contract cheat-sheet.

| # | Fact | Consequence for implementation |
|---|------|-------------------------------|
| 1 | All paths are prefixed `/api` | Base URL is the host only; paths already include `/api` |
| 2 | Auth: `POST /api/auth/login` returns JWT; `POST /api/refresh` renews it | **The refresh body is a JSON string of the token, not `{"refresh_token": ...}`** — a documented quirk; sending the object form fails |
| 3 | Envelope: responses may carry `success`, `payload` or `data`, plus `data`+`meta` pagination | Unwrap in order: if `success` present and `false` → treat as error **even when HTTP 200**; then prefer `payload`, then `data`; pass through raw when no envelope fields |
| 4 | IDs: v1 posts/comments/follows/blocks use **public UUIDs**; legacy profile endpoints (`/api/profile/{userId}`, `/api/users/{id}/posts`, follower lists) use **numeric IDs** | Never substitute one for the other; keep both in the user model |
| 5 | Health check: `GET /api/_health` | Use as startup probe before enabling the login form |
| 6 | Media: payloads contain CDN URLs; REST token must not be sent to the CDN | `<img src>` directly from the payload URL; never proxy or attach auth to media hosts |
| 7 | Uploads: `POST /api/v1/app/media/upload` (multipart `file`, `postId`, `mediaIndex`); create-post returns the post UUID in `payload` | Post creation is two steps: create post → upload media referencing it (Phase 3 only) |
| 8 | Messaging session: `POST /api/v1/app/msg/session` | **Ignore this and all `/msg/` and Matrix endpoints** — out of scope |

### Endpoint map (the subset this client is allowed to call)

| Feature | Method & path | Notes |
|---|---|---|
| Login | `POST /api/auth/login` | Returns JWT + refresh token |
| Refresh | `POST /api/refresh` | JSON-string body (fact #2) |
| Logout | `POST /api/logout` | Best effort |
| Health | `GET /api/_health` | Startup probe |
| Own user | `GET /api/user` | Hydrate session after login |
| Home feed | `GET /api/v1/app/feed` | Paginated; chronological |
| Feed refresh | `POST /api/v1/app/feed/refresh` | Manual "refresh" button only — **no auto-polling** |
| Post detail | `GET /api/v1/app/post/{publicId}` | UUID |
| Post comments | `GET /api/v1/app/posts/{postId}/comments` | Paginated |
| Comment replies | `GET /api/v1/app/comments/{commentId}/replies` | |
| Create comment | `POST /api/v1/app/comments` | |
| Delete own comment | `DELETE /api/v1/app/comments/{commentId}` | |
| Like / unlike post | `POST` / `DELETE /api/v1/app/posts/{postId}/like` | Idempotent pair — do not use legacy toggle `POST /api/like` |
| Post likes list | `GET /api/v1/app/posts/{postId}/likes` | Optional display |
| Profile by username | `GET /api/v1/app/user/by-username/{username}` | Resolves username → user + IDs |
| Profile (legacy) | `GET /api/profile/{userId}` | Numeric ID variant |
| User's posts | `GET /api/users/{id}/posts` | Legacy; numeric ID |
| Relations (followers/following) | `GET /api/v1/app/users/{publicId}/relations` | For profile view counts/lists |
| Follow / unfollow | `POST` / `DELETE /api/v1/app/users/{userId}/follow` | Idempotent pair; do not use `POST /api/follow` toggle |
| Search | `GET /api/search` | Users; add `GET /api/v1/app/search/posts-by-tag` for hashtags |
| Notifications | `GET /api/notification`, `GET /api/notification-count`, `POST /api/notification/seen/{id}`, `POST /api/notification/mark-all-seen` | Phase 3 |
| Stories (read) | `GET /api/v1/app/stories`, `POST /api/v1/app/stories/{publicId}/view` | Phase 3 |
| Create post | `POST /api/v1/app/post/create` | Phase 3; `InitializePostRequest` — send only required fields plus optional `title`, audience enum `PUBLIC`/`FOLLOWERS`/`CLOSE_FRIENDS` |
| Discover feed | `GET /api/v1/app/feed/discover` | Phase 4; handles both `items` and `posts` response shapes |

Everything else in the OpenAPI spec — admin, webhooks, FCM, OTP, account deletion, Matrix, location, referrals, entitlements — is **out of scope**. If a feature seems to require one of those, it is out of scope too.

---

## 3. Feature Priority List

Prioritized for actual daily use of a chronological, friends-first social network. Build strictly in this order; each tier must be fully working (acceptance criteria in §5) before the next.

### P0 — MVP core loop (read-mostly, highest value)

| Priority | Feature | Why first |
|---|---|---|
| 1 | **Login / logout / session** (JWT + refresh via proxy, HttpOnly cookie) | Nothing works without it |
| 2 | **Home feed** — chronological list of posts from people you follow, with infinite-scroll pagination | The single most-used surface of the product |
| 3 | **Post detail view** — full post + existing comments | Gateway to all interactions |
| 4 | **Profile view** — own profile and other users (avatar, bio, stats, grid/list of their posts, follower/following counts) | Second most-used surface; needed before follow |
| 5 | **Media rendering** — photos (and video playback via native `<video>`) in feed/profile | A photo-first social network without images is useless |

### P1 — Core social interactions (first write actions)

| Priority | Feature | Why |
|---|---|---|
| 6 | **Like / unlike post** | Cheapest, highest-frequency interaction; validates that writes work at all |
| 7 | **Comments** — view, create, reply, delete own | The main conversation mechanism; comment likes later |
| 8 | **Follow / unfollow** | Changes what the feed shows; core to the product's model |
| 9 | **Search** — users by name/username, posts by hashtag | How you find people to follow when there is no algorithm |

### P2 — Engagement depth

| Priority | Feature | Why |
|---|---|---|
| 10 | **Create post** — text-only first, then single photo via media upload | Now the client produces content, not just consumes; text-only keeps risk minimal |
| 11 | **Notifications** — list, unread count, mark seen | You notice replies/likes without the mobile app |
| 12 | **Stories (view only)** — story bar, viewer, mark seen | Big part of the app's daily use; read-only keeps risk low |
| 13 | **Discover feed** — basic tag browsing with `feed/discover` | Find new people; needs both `items` and `posts` response handling |

### P3 — Explicitly last / optional

| Priority | Feature | Why last |
|---|---|---|
| 14 | Account settings (password/email change, discover preferences, TOS/marketing flags) | Rarely used; touching them risks account state |
| 15 | Profile editing (bio, avatar upload, username) | Write-heavy, irreversible mistakes possible |
| 16 | Comment likes, pins, reposts/share, block management | Nice-to-haves |

### Never (out of scope)

E2EE direct messages (Matrix — requires browser-side Matrix crypto; a server proxy would defeat end-to-end encryption; defer to a dedicated future milestone using `matrix-js-sdk` in the browser), push notifications, registration, account deletion, membership/subscription actions, anything with `admin`/`webhook`/`fcm`/`msg` in the path.

---

## 4. Milestones

### Phase 0 — Foundation (no Monnett account needed)

1. Scaffold repo (layout in §6), FastAPI app + Vite app, run with one command each.
2. Snapshot the production **and** dev OpenAPI specs into `docs/openapi-{prod,dev}.json` (unauthenticated GET). Commit them: they are the contract of record.
3. Build `monnett_client.py` (httpx): base URL config, `request()` with envelope unwrapping (fact #3), 401 → single-flight refresh (fact #2), error normalization to a single `MonnettApiError(status, message, code)`.
4. Pass-through proxy: every backend route `/m/{path}` forwards to `{MONNETT_API_BASE}/api/{path}` with the session's Bearer token; responses returned unwrapped.
5. `GET /api/_health` probe on the login page: disable login form + show a banner if the environment is down.

**Acceptance:** unit tests for envelope unwrapping and refresh-body quirk (mock server); `GET /m/_health` returns 200 through the proxy; nothing else exists yet.

### Phase 1 — P0 (needs a real **test** account on the dev environment)

Login form → session cookie → feed page with pagination → post detail → profile pages → media rendering. All data read-only.

**Acceptance:** log in on `api-dev`, scroll 3 pages of the feed, open a post and its author's profile, images render; refresh token rotation works after letting the JWT expire (or shortening it in dev); hard-logout clears the cookie and calls `/api/logout`.

### Phase 2 — P1 (first writes, on dev)

Like/unlike, comments (create/reply/delete), follow/unfollow, user + hashtag search. Optimistic UI updates with rollback on error. Idempotent v1 endpoints only.

**Acceptance:** like a post and verify persistence after reload; comment and reply; follow a user and see their posts appear in the feed; search finds a known user. Every write has an error state and a manual undo path.

### Phase 3 — P2

Text post creation → photo posts (create post, then `media/upload` with `postId`), notifications, stories view, discover. Feature-flag each (`ENABLE_CREATE_POST`, etc.) so any of them can be disabled by config if the API changes.

**Acceptance:** create a text post on dev, see it in feed and profile; photo upload completes and renders; notifications list and mark-all-seen work; stories view marks seen.

### Phase 4 — Production switch + hardening

1. Point `MONNETT_API_BASE` at production with a **secondary personal account** first; smoke-test P0–P2.
2. Add the passcode gate, security headers, `SameSite=Lax`/`Secure`/`HttpOnly` cookies, request logging **with token fields redacted**, and a global rate limit (e.g., ≤ 60 req/min) as a guardrail against runaway clients.
3. Add a one-page in-app notice: unofficial client, personal use, API unsupported and may break without notice.

**Acceptance:** full core loop works on production; no tokens appear in any log line; refresh still works.

---

## 5. Acceptance & Testing Rules (for the agent)

- **Mock-first:** all envelope/auth quirks are unit-tested against a local mock built from the OpenAPI snapshot; never write integration tests that hit production.
- **Dev-before-prod:** any call to the production API requires a preceding green run against `api-dev`.
- **Manual verification checklist per phase** (login → scroll → open post → profile → interact) is run by the human owner; the agent does not invent "verified live" claims.
- **No retries on writes** after network errors/429/5xx — surface the error and let the user decide (prevents duplicate posts/likes). Retry only after an explicit 401 + successful refresh.
- **Never log tokens**, request bodies containing them, or full responses. Redact `Authorization` headers.
- **Breaking-change protocol:** if a call starts failing, diff the live OpenAPI against `docs/openapi-prod.json`; if the contract changed, update the client and the snapshot in one commit. Do not silently work around with undocumented routes.

---

## 6. Repository Layout

```
monnett-web/
├── PLAN.md                  # this document
├── docs/
│   ├── openapi-prod.json    # snapshot of api.monnettsocial.com/openapi.json
│   └── openapi-dev.json     # snapshot of api-dev.monnettsocial.com/openapi.json
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI wiring, routes: /auth/*, /m/{path}
│   │   ├── config.py         # env vars: MONNETT_API_BASE, SESSION_SECRET, ...
│   │   ├── session.py        # encrypted cookie (JWT + refresh token), passcode gate
│   │   ├── monnett_client.py # httpx client: envelope unwrap, refresh, errors
│   │   └── schemas.py        # pydantic models generated/hand-copied from the snapshot
│   └── tests/                # mock-server unit tests (envelope, refresh, idempotency)
└── frontend/
    ├── src/
    │   ├── api.ts            # typed fetch wrapper → backend /m/* and /auth/*
    │   ├── hooks.ts           # useApi (loading/error/refetch), useSession
    │   ├── components/        # PostCard, PostDetail, CommentList, ProfileHeader, Avatar, Media
    │   ├── pages/             # Login, Feed, PostDetail, Profile, Search, Notifications
    │   └── main.tsx / router
    └── (Vite defaults)
```

Two frontend components worth designing carefully because they dominate perceived quality: **PostCard** (feed) and **ProfilePage** (posts grid + header). Everything else can be plain and functional.

---

## 7. Risk Register

| Risk | Severity | Mitigation (already baked into this plan) |
|---|---|---|
| API changes without notice (platform just left beta) | High | OpenAPI snapshots; single `monnett_client.py`; feature flags; breaking-change protocol §5 |
| Account suspension under ToS ("misuse without permission") | Medium–High | Personal single account, human-paced usage, no polling/scraping, dev environment for testing, optionally request permission from Monnett |
| Token theft (XSS) | High | Tokens never in JS; HttpOnly encrypted cookie; minimal dependencies; no `dangerouslySetInnerHTML` |
| Duplicate writes (like/comment posted twice) | Medium | No auto-retry on writes; idempotent v1 endpoints; optimistic UI with rollback |
| E2EE messaging complexity | — (avoided) | Entirely out of scope; would defeat encryption if proxied |
| Refresh-token quirk mishandled (lockouts) | Medium | JSON-string body unit-tested; single-flight refresh; explicit refresh-error logout |
| CORS / blocked clients in future | Medium | All traffic through one proxy origin; if Monnett adds client checks, stop and reassess rather than spoof app headers — **do not impersonate the official app's user-agent or fingerprints** |

---

## 8. Sources & Provenance (for the executing agent: read, don't re-derive)

- Official OpenAPI 3.1 specs: `https://api.monnettsocial.com/openapi.json` and `https://api-dev.monnettsocial.com/openapi.json` (verified publicly reachable, November 2026).
- Endpoint map cross-checked against the unofficial `monnett-qt` project's coverage doc (`github.com/omauser119/monnett-qt`, `docs/API_COVERAGE.md`, snapshot 18 October 2026): 165 official operations + 2 legacy reverse-engineered routes. This plan uses **only official** routes.
- API quirk details (refresh body, envelope, UUID vs numeric IDs, multipart fields): `monnett-qt` `docs/CONTRACT_NOTES.md`.
- Terms context: Monnett Terms of Use (effective 15 October 2026, Luxembourg law) — no explicit reverse-engineering ban, but prohibits service misuse without permission; this plan is designed to stay on the conservative side of that line.

