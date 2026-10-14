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
- Permissions are checked in the **service** layer, using roles defined in each module's `01-users.md`.

## Environments

How dev → production switching works: **code is identical; only env vars differ.** The deploy pipeline provides production values. Nobody edits code or config files to "switch to prod" before a commit.

| Variable | Where | development | production |
|---|---|---|---|
| `APP_ENV` | backend | `development` | `production` |
| `GIN_MODE` | backend | `debug` | `release` |
| `HTTP_PORT` | backend | `8080` | from platform |
| `DATABASE_URL` | backend | local docker | secret from platform |
| `CORS_ALLOWED_ORIGINS` | backend | `http://localhost:3000` | prod FE URL |
| `SSO_*` | backend | dev tenant | secret from platform |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | `http://localhost:8080/api/v1` | prod API URL (set at **build** time) |
| `NEXT_PUBLIC_USE_MOCKS` | frontend | `true` while UI is built against mocks | `false` |

Add new variables to this table, to `backend/.env.example` or `frontend/.env.*`, and to `lib/env.ts` / `platform/config` in the same change.
