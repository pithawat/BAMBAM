# Stage 0 — Platform

Status: DRAFT

<!-- Done once per project, before any module stage. Goal: an empty but real app
     that logs in through SSO, talks to the API, and deploys to both environments. -->

## Acceptance criteria

- [ ] `backend/` scaffolded per backend/AGENTS.md (platform packages, Makefile, sqlc.yaml, goose, `.env.example`)
- [ ] `frontend/` scaffolded per frontend/AGENTS.md (Next.js 16, TS strict, shadcn init, Playwright, `lib/env.ts`, `lib/http.ts`)
- [ ] Theme tokens from `docs/shared/design-system.md` applied to `globals.css` *(skip if P2 Style not approved yet; do it at the first module stage)*
- [ ] Shared components: AppShell (nav lists all modules from PROJECT.md), PageHeader, EmptyState, ErrorState, ForbiddenState
- [ ] SSO login works end to end in development (per `docs/shared/integrations/sso.md`); `proxy.ts` protects `(app)` routes
- [ ] `GET /api/v1/health` and `GET /api/v1/me` work; FE shows the logged-in user
- [ ] Env switching verified: dev values locally, production values only from the deploy platform
- [ ] CI: lint + typecheck + test on every push; deploy on (✏️ main branch / tag)
- [ ] One Playwright smoke test: login → see app shell

## Demo

<!-- agent fills in: commands, URLs, test account -->

## Progress

- **Now:**
- **Done:**
- **Open issues:**
