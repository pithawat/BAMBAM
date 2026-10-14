---
name: ui-spec
description: Phase P3 — write screen specs, HTML mockups and the Codex handoff for a module, from its approved flows and the approved design system. No code.
disable-model-invocation: true
argument-hint: <module_key>
---

Module `$0`. Phase P3 UI spec. No application code.

Preconditions: `docs/modules/$0/02-flows.md` and `docs/shared/design-system.md` are both APPROVED. If not, stop and say which one is missing.

Read: `01-users.md`, `02-flows.md`, `docs/shared/design-system.md`, glossary and locale in `docs/PROJECT.md`.

1. **Screen inventory.** Derive screens from the flows: table of S-id, name, flows, persona + device, route. Reuse one screen across flows where possible. Show it and get a quick OK before writing specs (cheap to change now).
2. **Specs.** For each screen write `ui/screens/S##-<slug>.md` from `S00-template.md`: ASCII layout (mobile first + desktop notes), components from design-system.md only, exact Thai copy, every state, interactions and validation messages, acceptance checklist.
3. **Mockups.** Write `ui/mockups/S##-<slug>.html` only for screens that introduce a new layout pattern (usually 2–4). Same token names and values as design-system.md, realistic Thai data, 375px and 1280px views. Other screens point to the closest existing mockup in their spec.
4. **Handoff.** Write `ui/HANDOFF.md` from the template with all screens (stage column is filled by `/stage-plan`).
5. **Present** the inventory and which mockups to open. Iterate. On approval write `Status: APPROVED (YYYY-MM-DD)` on each spec; update `PROGRESS.md`.

If a screen decision would change a flow, record it as an open question or start `/change-request` — never change approved flows silently.

Next step for the user: `/stage-plan $0`.
