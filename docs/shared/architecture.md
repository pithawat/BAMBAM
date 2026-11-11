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

### Roles and permissions (D-003, D-004, D-049, D-111; rewritten in settings Stage 6)

- SSO gives identity only. A person's role is their row in `platform.user_roles` (keyed by `employee_code`, SSO claim `USER`); no row = `employee` (first login creates the user as `employee`). One role per person, shared by every module.
- **Roles are data** (`platform.roles`): stable `key` (`employee` · `housekeeper_lead` · `security_lead` · `technician` · `admin` · `super_admin`, custom roles `r_` + 8 hex), editable Thai `name`. `employee` and `super_admin` are system roles (cannot be deleted); `super_admin` is locked (cannot be edited, has every permission). A role with real users cannot be deleted (demo users go with it). Superadmin manages roles, the matrix and people's roles in ตั้งค่าระบบ (settings S24 / S25).
- **Permissions are keys** registered in Go by each module (`repair.Permissions`, `settings.Permissions`, aggregated by `permissions.MustRegistry`). Stored per role in `platform.role_permissions` (the matrix, version row `platform.permission_matrix` for `VERSION_CONFLICT`). The seven `settings.*` keys are **fixed**: granted from the role key (`admin`: locations · assets · categories; `super_admin`: all), never stored, never copied to custom roles.
- **Checks use keys, never role names**: backend `RequirePermission(...)` on routes + `Viewer.Can` / `Principal.Can` in services; FE `can(me, PERM.x)` for menus only (never for security). Permissions load on **every request** (one query with the user, `GetUserWithRole`), so matrix and role changes apply on the next request without logging out.
- `GET /api/v1/me` returns the user, `role`, `roleName` and the effective `permissions`.
- `SUPER_ADMIN_EMPLOYEE_CODES` (comma-separated employee codes, per environment): those people are `super_admin` at API start and at every login, and their role cannot be changed on screen (`ROLE_LOCKED`). At least one code per environment before UAT; without any, the API logs a warning when no user has `super_admin`.
- Every settings write appends to `platform.audit_log` in the same transaction with `data = { entityName, parentName?, changes }` (settings F30); the dev role switch writes `dev.role_switch` rows that ประวัติการเปลี่ยนแปลง does not list.

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
| `PHOTO_STORAGE_DIR` | backend | optional, default `data/photos` (gitignored) | required: persistent volume, backed up (D-022) |
| `SUPER_ADMIN_EMPLOYEE_CODES` | backend | optional, comma-separated employee codes (empty → warning at start) | the first Superadmin code(s) per environment (settings BR-F25-2) |

Add new variables to this table, to `backend/.env.example` or `frontend/.env.*`, and to `lib/env.ts` / `platform/config` in the same change.
