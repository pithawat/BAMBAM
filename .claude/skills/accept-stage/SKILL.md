---
name: accept-stage
description: After the user accepts a stage — commit, tag, update status files and set up the next session.
disable-model-invocation: true
argument-hint: <module_key> <stage_number>
---

Module `$0`, stage `$1` accepted by the user.

1. Check the stage report in `docs/modules/$0/PROGRESS.md`. If any acceptance criterion is ❌, ask whether to accept anyway (then record it in `docs/DECISIONS.md`) or stop.
2. Commit on branch `$0/stage-$1` with message `feat($0): stage $1 — <goal>` and tag `$0-stage-$1`. Ask before merging or pushing; follow the user's git flow.
3. Update:
   - `03-plan.md` — stage status `done`
   - `PROGRESS.md` — compress this stage into one "Stage log" line; set Next to the next stage (or "module complete")
   - `docs/PROJECT.md` — the module row
   - System Atlas — follow `/atlas sync $0` (stage `accepted` + today's date); list flows that became runnable so a tour can be written (`/atlas tour`)
4. Reply in Thai, ≤4 lines: what was tagged, what comes next, and to start a fresh session (`/clear`) before `/build-stage $0 <next> prepare`.
