---
name: atlas
description: Keep the System Atlas (docs/atlas) in sync with the approved docs, write Playwright tours for accepted flows, and turn Atlas notes into change requests. Use after a stage is accepted, after a CR is applied, or when the user asks about the atlas.
argument-hint: sync <module> | tour <module> <flow> | notes <module> | check
---

System Atlas = `tools/atlas/` (engine, same in every project — do not edit it here) + `docs/atlas/` (this project's data).
Read `tools/atlas/SPEC.md` before writing data. Validate with `node tools/atlas/cli.mjs check` after every change.

## Rules

- The data **mirrors approved documents**. Never invent features, roles, flows, dates or statuses. Unclear → ask the user or leave it out and say so.
- A stage is `accepted` only when the owner accepted it (PROGRESS / PROJECT / tag says so). Only accepted stages carry `date` = the acceptance date. No planned dates.
- A flow is runnable only when every stage it belongs to is accepted. Write tours only for those.
- Tours use dev/UAT demo users through `session(role)`. Data a tour creates must be unique (`{{run}}`) and cleaned up by the tour.
- User-facing text (names, desc, captions) is in the UI language and written for the end user: what they do and what they should see.

## `sync <module>`

Read only the module's sources (listed in `docs/atlas/modules/<m>.json` → `sources`; default `01-users.md`, `02-flows.md`, `03-plan.md`, `PROGRESS.md`, `changes/`). Then update `docs/atlas/modules/<m>.json`:

1. `stages` from the plan's stage table + PROGRESS (status, acceptance date, flows, CR).
2. `crs` — approved CRs with their approval date, `after` = the last stage done before it.
3. `roles` + `matrix` from the permission table in `01-users.md` (one row per action group, `true` or short text).
4. `features` — one per user-visible capability (not per screen). Status = its stage's status. `e2e` from the last run in PROGRESS.
5. `flows` — one per flow in `02-flows.md`, plus the overview path (`overviewFlow`). Swimlane layout:
   - lanes = the actors that do something in the flow (+ `sys` for automatic steps, external systems as their own lane);
   - rows top → bottom in step order; a decision's branches go sideways to the next column or slot;
   - box text ≤ 2 short lines; link boxes (`t: "link"`) to other flows instead of redrawing them; ≤ ~12 boxes per flow;
   - keep node ids stable between syncs — tours point at them.
6. `node tools/atlas/cli.mjs check`, fix every problem, then tell the user in ≤ 5 lines what changed (stages, new runnable flows).

New module: add it to `docs/atlas/project.json` → `modules`, and any new actor to `actors`.

## `tour <module> <flow>`

1. Check the flow is runnable (every stage accepted). If not, stop and say which stage is missing.
2. Base the tour **only** on the flow's e2e that passes (`frontend/e2e/**/<flow>*.spec.ts`, last run in PROGRESS): same locators, waits and data rules, and record it in `tour.from` (spec + test titles). If the e2e is not passing, stop — fix the e2e first. One step = one thing the tester should look at or press; `node` = the swimlane box it belongs to; `title` / `desc` / `expect` double as the UAT script.
3. `node tools/atlas/cli.mjs verify <module>/<flow>` (needs the app running) until it passes; a failure prints the step and a screenshot path in the OS temp folder. Then run it once in the popup (serve → ▶) and check every step: the ring is on the right element, the caption matches the screen.
4. Data-changing tours: ask the user before the first run against a shared database.

## `notes <module>`

Read `docs/atlas/notes.json` → `<module>`. Group the open notes by flow / screen and propose what to do with each (fix inside the current stage, or a change request). Do not edit approved docs from a note — use `/change-request`. Mark a note `done` only when its fix is merged or the user says so.

## `check`

`node tools/atlas/cli.mjs check` and report only the problems.
