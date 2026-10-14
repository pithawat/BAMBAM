---
name: sso-login
description: Use when implementing or changing login, SSO, logout, session handling, the backend auth guard, current-user endpoints, or the Next.js src/proxy.ts auth gate.
---

Before writing any auth code:

1. Read `docs/shared/integrations/sso.md` completely. It is the only source for provider settings, claims mapping and security rules. If it is still the empty template, stop and ask the user to paste their SSO configuration document there.
2. Read the Auth and Environments sections of `docs/shared/architecture.md`.

Rules:

- All values come from the env vars listed in sso.md. Never hard-code issuer, client id, secrets or redirect URLs. New vars go into `backend/.env.example`, `frontend/.env.*` and the env table in architecture.md in the same change.
- Backend: flow, token validation and session live in `internal/platform/auth`; the guard in `internal/platform/middleware`. Modules only read the current user from the request context.
- Frontend: `src/proxy.ts` (Next.js 16 — never `middleware.ts`) redirects unauthenticated users. Don't store tokens in `localStorage` unless sso.md says so.
- Test: login, logout, expired session, user without the required role (403 screen).
- Anything sso.md does not cover → ask. Never guess security behaviour.
