---
name: change-request
description: Handle any change to an approved flow, screen, plan or API contract — impact analysis first, apply only after approval. Use whenever the user wants to change something already approved, even mid-stage.
argument-hint: <module_key> "<what changed>"
---

Module `$0`. Requested change: $1

1. **Read** `PROGRESS.md`, the `03-plan.md` stage table, and only the docs the change touches (find them by flow / screen IDs).
2. **Create** `changes/CR-###.md` (next free number) from `docs/modules/_template/changes/CR-000-template.md`. Fill "What changes" and "Why" in the user's words.
3. **Impact analysis.** Trace by ID: flows → screens → stages → contract → DB → e2e tests → other modules (grep IDs and endpoint paths across `docs/`, `backend/`, `frontend/`). Mark each item built or pending. Size it:
   - **S** — only the current stage, no contract or DB change
   - **M** — touches a finished stage or the API contract
   - **L** — changes a main flow or the data model across stages
4. **Present** the impact table, size and your recommendation in Thai. **Wait for approval. Edit nothing else before that.**
5. **After approval:**
   - update source docs; tag changed lines `(CR-###)`; approved files stay APPROVED
   - S → add tasks to the current stage · M → add rework tasks to `03-plan.md` · L → re-plan from the earliest affected stage
   - update `ui/HANDOFF.md` if screens change; add `D-###` to `docs/DECISIONS.md`; set CR status APPROVED
   - write code only as part of a stage
6. Update `PROGRESS.md` (Next, Open issues).
