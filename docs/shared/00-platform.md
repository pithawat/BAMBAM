# Stage 0 — Platform

Status: ACCEPTED (2026-10-14)

<!-- Done once per project, before any module stage. Goal: an empty but real app
     that logs in through SSO, talks to the API, and deploys to both environments. -->

## Acceptance criteria

- [x] `backend/` scaffolded per backend/AGENTS.md (platform packages, Makefile, sqlc.yaml, goose, `.env.example`)
- [x] `frontend/` scaffolded per frontend/AGENTS.md (Next.js 16, TS strict, shadcn init, Playwright, `lib/env.ts`, `lib/http.ts`)
- [x] Theme tokens from `docs/shared/design-system.md` applied to `globals.css` *(skip if P2 Style not approved yet; do it at the first module stage)*
- [x] Shared components: AppShell (nav lists all modules from PROJECT.md), PageHeader, EmptyState, ErrorState, ForbiddenState
- [x] SSO login works end to end in development (per `docs/shared/integrations/sso.md`); `proxy.ts` protects `(app)` routes
- [x] `GET /api/v1/health` and `GET /api/v1/me` work; FE shows the logged-in user
- [ ] Env switching verified: dev values locally, production values only from the deploy platform — *deferred until the deploy platform is known (D-031)*
- [x] CI: lint + typecheck + test on every push (`.github/workflows/ci.yml`); deploy deferred until the platform is known (D-030)
- [x] One Playwright smoke test: login → see app shell (`frontend/e2e/platform/F01-login-shell.spec.ts`, demo-user session via `cmd/devsession`, D-029)
- [x] Repair screens built here (specs in `docs/modules/repair/ui/screens/`): S01 login / signed-out, S14 profile + logout, S15 role switcher (+ `GET /api/v1/dev/demo-users`, one demo user per role with the names in `_common.md` §8), AppShell per `_common.md` §1 (role-based sidebar, top bar, `BottomNav`; bell and Home as placeholders until repair Stage 7)
- [x] Shared components used by repair: `Mascot`, `ServiceIcon`, `ServiceHeader`, `PriorityIndicator`, `RoleSwitcher`, `BottomNav`

## Demo

Prerequisites: Docker Desktop, Go (1.26 toolchain auto-downloads), Node ≥ 20.18.1 (22 recommended), tools: `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest github.com/pressly/goose/v3/cmd/goose@latest github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`

```
# 1. database (Postgres 17 on host port 5433 — 5432 is often a local Windows PostgreSQL)
docker compose up -d db

# 2. backend  (first time: cp backend/.env.example backend/.env, fill SSO_CLIENT_SECRET from bam-sso-handoff.md
#              and APP_SESSION_SECRET = openssl rand -base64 48)
cd backend
make migrate-up        # no make on Windows: goose -dir db/migrations postgres "<DATABASE_URL>" up
make run               # no make: APP_ENV=development go run ./cmd/api   → http://localhost:8080/api/v1/health

# 3. frontend
cd frontend && npm install
npm run dev            # http://localhost:3000
                       # mocks (no backend) by default; for real SSO put NEXT_PUBLIC_USE_MOCKS=false in frontend/.env.local

# checks
cd backend && go test ./... && golangci-lint run
cd frontend && npm run lint && npm run typecheck && npm run build
cd frontend && npx playwright install chromium && npm run test:e2e   # needs step 1 + migrations; starts API and Next itself
```

| What | URL / account |
|---|---|
| App | http://localhost:3000 → `/login` → "เข้าสู่ระบบ" → RMC SSO (DEV client `bam`) with a real RMC account |
| First login | role `employee` (D-003); other roles via `platform.user_roles` (seed file still pending) |
| Role switcher | pill "ดูในบทบาท" (DEV) → 6 demo users from `_common.md` §8; back to own account = logout + login |
| API session without SSO (dev only) | `cd backend && go run ./cmd/devsession -role admin` → prints a `bam_session` cookie value |
| Readiness for RMC SSO | `GET /health/ready` with `Authorization: Bearer <SSO_CLIENT_SECRET>` |

**Known gaps (open):**
- Maintenance guard (poll `/api/maintenance/status`, `/api/maintenance/access`) — required before production, not built
- Production/UAT: redirect URIs not registered, deploy platform unknown → no deploy job; `API_INTERNAL_URL` must be set at build/start
- Session length 12h fixed, no refresh — default chosen in Stage 0, confirm
- `technicianCategories` in `/me` is empty until repair Stage 2 wires `users.TechnicianCategories`
- Role seed file (employee code → role) — waiting for real data
- Bottom-nav / sidebar links to repair routes 404 until their stages; bell has no count until Stage 7
- Local Node is 20.11.1 (shadcn CLI needs ≥ 20.18.1) — upgrade to 22

## Progress

- **Now:** accepted 2026-10-14 (real SSO login confirmed by the user), tag `platform-stage-0`
- **Done:** backend scaffold (platform config/db/httpx/middleware/auth/users, migration `platform` schema, sqlc, Makefile, devsession CLI) · frontend scaffold (Next 16.4, shadcn radix-nova, tokens, fonts, brand assets, proxy.ts, rewrites, lib/env + lib/http + lib/platform) · shared components + S01/S14/S15/AppShell/Home placeholder · CI workflow · unit tests (Go) · FE lint/typecheck/build green · UI checked at 375/1280 in mock mode · migrations up/down/up on Postgres 17 · API checked with curl (401, login redirect, /me, demo users, role switch + audit) · Playwright 15 passed / 1 skipped (desktop + mobile)
- **Open issues:** see Demo → Known gaps
