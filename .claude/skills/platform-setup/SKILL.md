---
name: platform-setup
description: Stage 0 — scaffold backend and frontend, SSO login, env switching and CI per docs/shared/00-platform.md. Once per project.
disable-model-invocation: true
---

Stage 0 Platform. Once per project.

Preconditions: the ✏️ sections of `docs/PROJECT.md` are filled and `docs/shared/integrations/sso.md` is not the empty template. If not, list what is missing and stop.

Read: `docs/PROJECT.md`, `docs/shared/00-platform.md`, `docs/shared/architecture.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`. Use the `sso-login` skill for the auth items.

1. Show a short plan (≤10 lines) of the scaffold commands and folders, then start.
2. Work through the acceptance criteria in `00-platform.md` in order, ticking each box as it passes. Verify current CLI flags (create-next-app, shadcn) with `--help` instead of relying on memory.
   - `frontend/` already contains `AGENTS.md`, `CLAUDE.md` and `.env.*`. Scaffold Next.js into a temporary folder, then move its contents into `frontend/` without overwriting those files. If the scaffold generated its own agent files, merge anything useful into ours and delete theirs.
3. Apply design tokens to `globals.css` only if `docs/shared/design-system.md` is APPROVED.
4. Fill the Demo section of `00-platform.md` (commands, URLs, test account) and write a stage report (AGENTS.md §5). Stop and wait for acceptance; after it, commit and tag `platform-stage-0`.
