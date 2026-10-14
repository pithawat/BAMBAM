---
name: build-stage
description: Phase P5 — build one stage of a module. "prepare" builds the backend and the frontend contract, then hands the UI to Codex. "wire" connects the UI to the real API, adds e2e tests and writes the stage report.
disable-model-invocation: true
argument-hint: <module_key> <stage_number> prepare|wire
---

Module `$0`, stage `$1`, part `$2`.

**Always first:** read `docs/modules/$0/PROGRESS.md` and only the "Stage $1" section of `03-plan.md`. Check that `03-plan.md` and `04-api-contract.md` are APPROVED and `docs/shared/00-platform.md` is accepted; if not, stop and say so. Summarise in ≤5 lines what you will do. Work on branch `$0/stage-$1`.

## prepare

1. **Backend** (rules in `backend/AGENTS.md`): migration → `queries/*.sql` → `make sqlc` → repository → service with a unit test for every business rule in scope → dto / controller / routes → wire in `cmd/api/main.go`. Run `make lint test`.
2. **Frontend contract:**
   - `modules/$0/types.ts` exactly as `04-api-contract.md`
   - `modules/$0/mocks.ts` with realistic Thai data and named scenarios (`normal`, `empty`, `error`, `forbidden`)
   - `modules/$0/api.ts`: real calls via `lib/http.ts`; returns mocks when `NEXT_PUBLIC_USE_MOCKS=true`
   - empty route folders for this stage's screens if they don't exist
   - run `npm run typecheck`
3. **Handoff:** update `ui/HANDOFF.md` for stage $1 (screens, editable paths).
4. Update `PROGRESS.md` (Now: waiting for Codex UI). Tell the user in Thai: what the backend covers, test result, and the exact Codex prompt:
   > Use the implement-ui skill. Read docs/modules/$0/ui/HANDOFF.md and implement the Stage $1 screens. Follow it exactly.

   Then stop.

## wire

1. **Review** Codex's UI against each screen spec and mockup. Fix wiring or contract issues yourself. For visual mismatches, list them in HANDOFF "Differences" and ask the user: send back to Codex, or accept.
2. Answer HANDOFF "Open questions", or escalate to the user.
3. **Connect:** run with mocks off against the real API; fix integration bugs.
4. **E2E:** Playwright tests `frontend/e2e/$0/F##-*.spec.ts` for the flows in scope (happy path + edge cases in scope).
5. **Full check:** backend `make lint test`; frontend `npm run lint`, `typecheck`, `build`, `test:e2e`. Report failures only.
6. **Stage report** (AGENTS.md §5) into `PROGRESS.md` and as your reply. Stop and wait for the user to accept; then they run `/accept-stage $0 $1`.
