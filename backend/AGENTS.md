# Backend rules — Go + Gin, 3-tier

<!-- Reusable for any project on this stack. Project facts → docs/PROJECT.md -->

## Layout

```
backend/
├── cmd/api/main.go                 wiring only: config → db pool → repos → services → controllers → routes
├── internal/platform/
│   ├── config/                     load + validate env (fail fast on missing required vars)
│   ├── db/                         pgxpool setup, WithTx helper
│   ├── httpx/                      response envelope, error → status mapping, pagination
│   ├── middleware/                 request id, slog logging, recovery, CORS, auth guard
│   └── auth/                       SSO / session  (read docs/shared/integrations/sso.md first)
├── internal/modules/<m>/
│   ├── routes.go                   RegisterRoutes(rg *gin.RouterGroup, c *Controller)
│   ├── controller.go               HTTP layer
│   ├── dto.go                      request/response structs = 04-api-contract.md
│   ├── service.go                  business layer + Repository interface it depends on
│   ├── repository.go               data layer, wraps sqlc Queries
│   ├── model.go                    domain structs
│   ├── errors.go                   domain errors (ErrNotFound, ErrConflict, ErrForbidden, …)
│   ├── queries/*.sql               sqlc input
│   ├── db/                         sqlc output — generated, never edit by hand
│   └── service_test.go
├── db/migrations/                  goose SQL files: YYYYMMDDHHMMSS_<module>_<change>.sql
├── sqlc.yaml                       one `sql:` entry per module
├── Makefile
└── .env.example
```

## Layer rules (strict)

| Layer | Does | Never |
|---|---|---|
| controller | bind + validate DTO (`binding:` tags), read auth user from context, call service, map result/error to response via `httpx` | SQL, business rules, leaking internal error text |
| service | business rules, permissions, transactions, domain events/logging; takes `context.Context`; returns domain errors | `*gin.Context`, HTTP status codes, SQL |
| repository | run sqlc queries, map rows ↔ domain structs | business rules, HTTP concerns |

- Dependency direction: controller → service → repository **interface** (declared in `service.go`, the consumer).
- Transactions: service calls `db.WithTx(ctx, func(tx) error { … })` and builds repositories on that tx.
- Cross-module: depend on the other module's service interface, injected in `main.go`. Never import another module's `db/` or repository.

## Data access

- **sqlc + pgx/v5. No GORM. No AutoMigrate.**
- Schema changes only through a new goose migration. Never edit a migration that has been applied anywhere.
- Each module owns a Postgres schema named after the module key; shared tables live in schema `platform`.
- Every query takes `ctx`. Paginate every list query. Add indexes for every filter/sort the screens use.

## API

- Follow conventions in `docs/shared/architecture.md` (base path, envelope, error codes, dates, pagination).
- DTO JSON field names must match `04-api-contract.md` exactly. If they must change → CR.

## Config and environments

- All config from env vars; `APP_ENV=development|production`.
- Load a `.env` file **only** when `APP_ENV=development`. Production gets env from the deploy platform.
- `GIN_MODE=release` in production. CORS origins from env.
- Never branch business logic on `APP_ENV`; only config values differ.

## Logging and errors

- `log/slog`: text in development, JSON in production. Always include `request_id`.
- Never log secrets, tokens or personal data.
- Map domain errors → 400/401/403/404/409/422 in `httpx`. Everything else → 500 with a generic message.

## Commands (Makefile targets created in Stage 0)

```
make run            # APP_ENV=development go run ./cmd/api
make test           # go test ./... -race
make lint           # golangci-lint run
make sqlc           # sqlc generate
make migrate-up     # goose up
make migrate-new name=<module>_<change>
```

## Tests

- Service: unit tests for every business rule, using a fake repository.
- Controller: `httptest` for validation errors and status codes.
- Repository: integration tests against real Postgres (docker) for non-trivial queries.
