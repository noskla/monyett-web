# AGENTS.md — how to develop monyett-web

## Stack & rules

- Backend: Python 3.12+, FastAPI, httpx, cryptography (Fernet), pydantic. No DB, no ORM. Tests: pytest with `httpx.MockTransport` only — **never hit the real Monnett API in tests**. Dev-before-prod; production only for the owner-approved smoke test, read-only first.
- Frontend: Vite + React 18 + TypeScript, `react-router-dom` only extra dep (plus `lineicons`). Plain CSS. No state library; tiny `useQuery`/`useApi`/`useSession` hooks. No `dangerouslySetInnerHTML`.
- All Monnett quirks live in `backend/app/monnett_client.py` only. `/m/*` is an allowlist (+ denylist backstop), 60 req/min guardrail. Tokens only in the Fernet-encrypted HttpOnly cookie; never in JS or logs.
- Writes use idempotent v1 POST/DELETE pairs only, optimistic UI with rollback, **no auto-retry on writes**. No auto-polling of feeds (the 30s feed check only detects, never redraws).
- Feature flags: `ENABLE_CREATE_POST` / `ENABLE_NOTIFICATIONS` / `ENABLE_STORIES` / `ENABLE_DISCOVER`, exposed at `/api/features`.

## UI/brand conventions (owner-decided)

- Brand pink `#ff384f` accent (`--accent`), ink `#161922` bg, blue `#0089f7` links, logos from `frontend/public/`. **No emoji — Lineicons only**, and only names that exist in the free `lineicons` set (suffixed: `home-2`, `bell-1`, `comment-1`, `share-1`, `map-marker-1`, `camera-1`, `search-1`, `user-4`, `star-fat`, `chevron-*-circle`, `discover`, `x`, `heart`, `eye`, `plus`, `exit`).
- Avatars: ring (solid/gradient from API `avatar_ring_color(s)`/`avatarRingColor`) + bottom-right ✓ check for badged users (human/member); check color = API ring color else pink; scales with avatar size; non-badged users: plain. `avatarOf` must skip `*ring*` keys. Never show follower/following counts.
- Hashtags render as links to `/search?q=%23tag` (brand pink). Post time links to the post and shows exact datetime on hover. Photos: carousel for 2+, capped 70vh, click → lightbox (wheel zooms at cursor via pan-compensation math, drag pans, Esc/backdrop closes). Notifications panel in sidebar; icon per action type.
- Do not commit a fix until the owner confirms it renders correctly in their browser.

## Workflow

- Small commits with clear messages (see git log); suffix commits with the Mistral Vibe co-author trailer.
- Verify: `backend/.venv/bin/python -m pytest` (49 green) and `frontend: npm run build` clean. CI runs both.
- Run: uvicorn serves `frontend/dist` (rebuild after frontend changes; `index.html` is no-store). Dev: `backend/dev/mock_upstream.py` on :9999, login password `pw`; or `npm run dev` (restart it after dep changes). Owner workflow requires **restart uvicorn + hard-refresh** to see changes.
- Env: `MONNETT_API_BASE`, `SESSION_SECRET` (fixed value in prod), `CLIENT_ACCESS_PASSCODE`, `RATE_LIMIT_PER_MINUTE`, `COOKIE_SECURE` (auto from scheme/`X-Forwarded-Proto`).
- New upstream endpoint → add to allowlist in `backend/app/main.py` + a proxy test. Breaking change → diff live OpenAPI against `docs/openapi-prod.json`, update client + snapshot in one commit.
- Personal notes/handoff live in `ai-doc/` (gitignored).
