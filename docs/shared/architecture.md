# Architecture — cross-cutting conventions

<!-- Shared by every module and by both agents. Folder layouts live in backend/AGENTS.md and frontend/AGENTS.md. -->

## API conventions

- Base path: `/api/v1/<module>/<resource>` (shared: `/api/v1/health`, `/api/v1/me`)
- JSON field names: `camelCase`
- Success: `{ "data": <object|array>, "meta": { "page": 1, "pageSize": 20, "total": 134 } }` (`meta` only for lists)
- Error: `{ "error": { "code": "ITEM_NOT_FOUND", "message": "debug text in English", "fields": { "qty": "MUST_BE_POSITIVE" } } }`
  - `code` is stable, UPPER_SNAKE, documented in `04-api-contract.md`.
  - The frontend maps `code` → Thai message from the screen spec. Backend `message` is never shown to users.
- Status codes: 400 bad input · 401 not logged in · 403 no permission · 404 not found · 409 conflict · 422 business rule failed · 500 unexpected
- Dates/times: RFC 3339 in UTC over the wire; display in Asia/Bangkok.
- Money: ✏️ decide once (e.g. decimal string `"1234.50"`) and record in DECISIONS.md.
- Lists: `?page=&pageSize=&sort=field:asc&q=` ; default pageSize 20, max 100.

## Database

- PostgreSQL. One schema per module (`<module_key>`), plus `platform` for shared tables (users, roles, audit_log).
- Every table: `id` (uuid or bigint — decide in DECISIONS.md), `created_at`, `updated_at`; `created_by` when the screen shows it.
- Soft delete only when a flow requires restore/audit; otherwise hard delete.
- Migrations: goose SQL in `backend/db/migrations/`, filename `YYYYMMDDHHMMSS_<module>_<change>.sql`, always with a `-- +goose Down`.

## Auth

- SSO details: `docs/shared/integrations/sso.md` (the single source).
- Frontend gate: `src/proxy.ts`. Backend gate: `internal/platform/middleware` auth guard. Never rely on the frontend gate alone.
- The browser talks only to the frontend origin: Next.js rewrites `/api/*` and `/health/ready` to the Go API (D-026). Go owns the OIDC flow (`/api/auth/login`, `/api/auth/callback/rmc-sso`, `POST /api/auth/logout`) and the session cookie `bam_session` (httpOnly, Secure, SameSite=Lax; server-side row in `platform.sessions`, only the token hash is stored).
- `APP_ENV`: `development` · `uat` · `production` (D-027). `.env` is loaded only in `development`.
- Permissions are checked in the **service** layer. The role set is global (below); each module's `01-users.md` holds its permission matrix against these roles.

### Roles (D-003, D-004)

- SSO gives identity only. Roles live in `platform.user_roles`, one row per user, keyed by `employee_code` (SSO claim `USER`).
- Exactly one role per user, shared by all modules: `employee` · `housekeeper_lead` · `security_lead` · `technician` · `admin` · `executive`.
- First SSO login creates the user as `employee`. Phase 1: other roles come from a seed file (employee code → role). Later: admin edits roles in the user management screen (repair F15).
- `GET /api/v1/me` returns the user and role; the FE builds menus from it but never relies on it for security.

### Role switcher — dev/UAT only (D-005)

- Purpose: preview each role's UI with real backend permission checks.
- Mechanism: switch to a seeded `demo_user` (one per role, realistic Thai names, own sample tickets). Never changes a real user's role.
- Backend: `POST /api/v1/dev/role-switch { "role": "technician" }` → replaces the session with that demo user. The route is registered only when `APP_ENV != production` **and** `ROLE_SWITCHER_ENABLED=true`; demo users are seeded only in those environments.
- Frontend: floating "ดูในบทบาท…" control in the app shell, rendered only when `NEXT_PUBLIC_ROLE_SWITCHER=true` (build-time, so production bundles do not contain it). Always shows a visible banner "โหมดทดสอบ: กำลังดูในบทบาท <role>".
- Every switch is written to the audit log.

## Environments

How dev → production switching works: **code is identical; only env vars differ.** The deploy pipeline provides production values. Nobody edits code or config files to "switch to prod" before a commit.

| Variable | Where | development | production |
|---|---|---|---|
| `APP_ENV` | backend | `development` (UAT: `uat`) | `production` |
| `GIN_MODE` | backend | `debug` | `release` |
| `HTTP_PORT` | backend | `8080` | from platform |
| `DATABASE_URL` | backend | local docker | secret from platform |
| `CORS_ALLOWED_ORIGINS` | backend | `http://localhost:3000` | prod FE URL |
| `SSO_*` | backend | dev tenant | secret from platform |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | `/api/v1` (same origin, D-026) | `/api/v1` |
| `API_INTERNAL_URL` | frontend (server) | `http://localhost:8080` | Go API URL as seen from the Next.js server (read at build/start, D-026) |
| `NEXT_PUBLIC_USE_MOCKS` | frontend | `true` while UI is built against mocks | `false` |
| `ROLE_SWITCHER_ENABLED` | backend | `true` (also UAT) | unset — ignored when `APP_ENV=production` |
| `NEXT_PUBLIC_ROLE_SWITCHER` | frontend | `true` (also UAT) | `false` (set at **build** time) |
| `APP_SESSION_SECRET` | backend | random, `.env` only | secret from platform (not the SSO client secret) |
| `APP_SESSION_TTL` | backend | `12h` | from platform (default `12h`) |

Add new variables to this table, to `backend/.env.example` or `frontend/.env.*`, and to `lib/env.ts` / `platform/config` in the same change.
