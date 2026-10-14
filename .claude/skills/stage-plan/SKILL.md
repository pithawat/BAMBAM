---
name: stage-plan
description: Phase P4 — write the API contract and split a module into demoable stages with checkable acceptance criteria. No code.
disable-model-invocation: true
argument-hint: <module_key>
---

Module `$0`. Phase P4 Plan. No application code.

Preconditions: `02-flows.md` and all `ui/screens/*.md` are APPROVED.

Read: `02-flows.md`, the Data / States / Copy sections of each screen spec, `docs/shared/architecture.md`, `docs/PROJECT.md`.

1. **`04-api-contract.md`.** Endpoints derived from each screen's data needs. For each: request and response JSON with realistic values, error codes with the Thai message from the screen specs, allowed roles, stage. Follow the conventions in architecture.md exactly.
2. **`03-plan.md`.** Vertical slices:
   - Stage 1 = the main flow's happy path, end to end.
   - Then the remaining flows, then edge cases and permissions, then polish.
   - Each stage lists scope (flows, screens), backend tasks, FE contract tasks, Codex screens, wiring + e2e tasks, acceptance criteria that can be checked by running something or looking at a screen, and a demo script.
   - Size: one focused Claude session + one Codex task. Split anything bigger.
3. Fill the Stage column in `ui/HANDOFF.md`.
4. **Present** the stage table and the endpoint table. Iterate. On approval write `Status: APPROVED (YYYY-MM-DD)` on both files, update `PROGRESS.md` (Phase P5, next: Stage 1) and the module row in `PROJECT.md`.

Next step for the user: if `docs/shared/00-platform.md` is not accepted yet, build Stage 0 first; otherwise `/build-stage $0 1 prepare` in a fresh session.
