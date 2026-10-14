---
name: discovery
description: Phase P1 — interview the user, then write 01-users.md and 02-flows.md for a module and get them approved. No code.
disable-model-invocation: true
argument-hint: <module_key>
---

Module `$0`. Phase P1 Discovery. Do not write application code.

Read only: `docs/PROJECT.md` (glossary, locale, NFRs), `docs/modules/$0/00-brief.md`, and the files listed under its Attachments (open images).

1. **Reflect.** In Thai, ≤10 lines: the goal, the personas you can see, the flows you can see, the biggest unknowns.
2. **Interview** with AskUserQuestion: max 4 questions per round, concrete options, one topic per round. Cover, in this order:
   who exactly uses it, where and on what device → roles and permissions → the main flow end to end → what happens when things go wrong → rules with numbers (limits, deadlines, approval chains).
   Stop when every must-have flow can be written without guessing (usually 2–4 rounds).
3. **Write `01-users.md`** from the template: concrete personas (device, context, frequency, "a day with this task", success measure), anti-persona, permission matrix. Add new domain words to the Glossary in `docs/PROJECT.md`.
4. **Write `02-flows.md`**: flow index; one section per flow with ID, Mermaid, steps, edge-case table, business rules `BR-F##-n`, expected screens `S##`.
   - If the brief or attachments contain user flows, those are the primary source. Keep their structure, add only missing edge cases and rules, and list every addition under a heading "Added by Claude" in that flow so the user can see it.
5. **Present** in Thai: flow list (ID, name, one line each), assumptions you made, open questions. Ask the user to review the files (Mermaid renders in Obsidian and VS Code preview) and either edit them directly or tell you what to change.
6. **Iterate.** When the user approves, write `Status: APPROVED (YYYY-MM-DD)` at the top of both files, update `PROGRESS.md` and the module row in `PROJECT.md`.
7. **Next step** for the user: `/style-options` if `docs/shared/design-system.md` is not APPROVED yet, otherwise `/ui-spec $0`.
