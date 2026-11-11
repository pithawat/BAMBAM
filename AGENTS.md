# AGENTS.md — Core rules (reusable across projects)

<!-- webapp-starter-kit v1.0
     This file is project-agnostic. Never put project facts here.
     Project facts → docs/PROJECT.md. Stack rules → backend/AGENTS.md, frontend/AGENTS.md. -->

## 0. Read first

- Project facts (modules, domain, glossary, environments): `docs/PROJECT.md`
- Talk to the user in **Thai**. Write code, comments, commit messages and agent-facing docs in **English**. UI copy follows the screen spec (usually Thai).
- Use the glossary in `docs/PROJECT.md` for every name in code (tables, types, routes). Do not invent synonyms.

## 1. Repo map

```
docs/PROJECT.md              project facts + module status table
docs/DECISIONS.md            decision log (append-only)
docs/shared/                 cross-module: platform stage, architecture, style, design system, integrations
docs/modules/<module>/       one folder per module (system): brief → users → flows → ui → plan → progress
backend/                     Go + Gin API        (rules: backend/AGENTS.md)
frontend/                    Next.js app         (rules: frontend/AGENTS.md)
docs/atlas/                  System Atlas data (features, flows, tours, timeline, notes) — mirrors approved docs
tools/atlas/                 System Atlas engine + UI, project-agnostic (README.md, SPEC.md); do not edit per project
```

## 2. Workflow and gates

Every module goes through these phases in order. A gate passes **only when the user says so**; then write `Status: APPROVED (YYYY-MM-DD)` at the top of that file.

| Phase | Input | Output | Gate |
|---|---|---|---|
| P0 Platform (once per project) | `docs/PROJECT.md` | `docs/shared/00-platform.md` checklist done | user accepts Stage 0 |
| P1 Discovery | `00-brief.md` (+ any flow drafts) | `01-users.md`, `02-flows.md` | user approves flows |
| P2 Style (once per project) | `docs/shared/style/brief.md` + `references/` | `style/options/*.html` → `docs/shared/design-system.md` | user picks and approves |
| P3 UI spec | approved flows + design system | `ui/screens/*.md`, `ui/mockups/*.html`, `ui/HANDOFF.md` | user approves screens |
| P4 Plan | all of the above | `03-plan.md`, `04-api-contract.md` | user approves plan |
| P5 Build (loop) | one stage of `03-plan.md` | code + tests + `PROGRESS.md` | user accepts the stage |

Hard rules:
- No module code before that module's `02-flows.md` and `03-plan.md` are APPROVED.
- Work on **one stage at a time**. When its acceptance criteria pass: stop, write the stage report (§5), and wait. Never start the next stage on your own.
- Unclear or contradictory docs → ask the user, or add the item under "Open questions" in the relevant doc. **Never guess business rules.**
- Never describe a real product, app or brand from memory. Use only screenshots, files or URLs the user provided (or pages you actually fetched). If you have none, say so and ask.

## 3. Context map — read only what the task needs

| The task touches | Read first |
|---|---|
| Anything in a module | `docs/modules/<m>/PROGRESS.md`, then the doc for the current phase |
| Login, SSO, session, auth middleware, `proxy.ts` | `docs/shared/integrations/sso.md` |
| UI, styling, components | `docs/shared/design-system.md` + the screen spec in `docs/modules/<m>/ui/screens/` |
| Data exchanged between FE and BE | `docs/modules/<m>/04-api-contract.md` |
| DB schema, migrations, API conventions, env/config/deploy | `docs/shared/architecture.md` |
| e2e, System Atlas, test database / test stack | `docs/shared/test-stack.md` |

Do not scan the whole repo. Do not read other modules' docs unless the task crosses modules.

## 4. Memory — the files are the memory

- Chat history is not memory. Anything that must survive a new session goes into a file.
- End of every task: update `docs/modules/<m>/PROGRESS.md` (Now / Done / Next / Open issues). Keep it under ~60 lines; compress old items into one-liners in "Stage log".
- Decisions that change scope, design or architecture: append to `docs/DECISIONS.md` as `D-### | date | module | decision | why`.
- Start of every session: read the module's `PROGRESS.md`, summarise in ≤5 lines what you will do, then start.

## 5. Stage report (end of every stage)

Append to `PROGRESS.md` and reply to the user with:
1. What was built (bullets)
2. Acceptance criteria checklist (✅ / ❌ for each)
3. How to demo: commands, URLs, test account
4. Tests run and result (failures only, not full logs)
5. Known gaps and new open questions
6. Shared code touched (`internal/platform`, `components/shared`, `lib`)

Then wait. After the user accepts: commit, tag `<module>-stage-<n>`, update the module row in `docs/PROJECT.md`.

## 6. Change requests (CR)

A change to anything APPROVED (flow, screen, plan, contract) is a CR. Never edit approved docs silently.
1. Create `docs/modules/<m>/changes/CR-###.md` from `docs/modules/_template/changes/CR-000-template.md`.
2. Impact analysis **first**: affected flows, screens, stages (done / pending), API, DB, tests. Size it S / M / L.
3. Wait for approval.
4. Update the source docs and tag changed lines with `(CR-###)`.
5. S → do it inside the current stage. M → add rework tasks to `03-plan.md`. L → re-plan from the earliest affected stage.

## 7. Multi-module rules

- Each module is a vertical slice: its own docs folder, backend package, frontend folder and DB schema.
- A module never imports another module's repository or generated DB code. Cross-module calls go through the other module's service interface, wired in `backend/cmd/api/main.go`.
- Shared code lives only in `backend/internal/platform/` and `frontend/src/{components/shared,lib}/`. Mention any change there in the stage report.

## 8. Roles when Claude and Codex share the repo

- **Claude**: discovery, style options, UI spec, plan, API contract, backend, FE types/mocks/API client, wiring, e2e tests, reviews.
- **Codex**: builds UI from `docs/modules/<m>/ui/HANDOFF.md` against mocks. Does not change backend, contract or docs, except the HANDOFF checklist and "Open questions".
- During a stage, never edit files the other agent owns (listed in `HANDOFF.md`).

### Handoff loop (one stage)

The user carries prompts between the agents. Both work in this same repo and read these same files.

1. **Claude** runs `/build-stage <m> <n> prepare`: backend, `types.ts` / `mocks.ts` / `api.ts`, and `ui/HANDOFF.md` with `Status: READY FOR CODEX — Stage <n>`. Claude ends its reply with the exact Codex prompt in a code block and copies it to `PROGRESS.md` → Next:
   `Use the implement-ui skill. Read docs/modules/<m>/ui/HANDOFF.md and implement the Stage <n> screens. Follow it exactly.`
2. **Codex** (the user pastes that prompt): reads `docs/modules/<m>/PROGRESS.md` and `HANDOFF.md`. If HANDOFF is not `READY FOR CODEX` for that stage, stop and tell the user. Otherwise build with `.agents/skills/implement-ui`, then set `Status: UI DONE — Stage <n>, waiting for Claude wire` and tell the user to run `/build-stage <m> <n> wire` in Claude Code.
3. **Claude** runs `/build-stage <m> <n> wire`: review, connect the real API, e2e, stage report.

HTML mockups (`ui/mockups/*.html`) come from Claude in P3 and are only a visual reference. The real UI is built by Codex in P5. Codex does not write phase documents (P1–P4): flows, screen specs, mockups, plan, contract.

## 9. Definition of done

- Build, lint, typecheck and tests pass (commands in `backend/AGENTS.md`, `frontend/AGENTS.md`).
- Every screen handles loading, empty, error and forbidden states.
- No secrets in code or commits. Environment differences only via env vars.
- No `TODO` without a matching item in `PROGRESS.md` → Open issues.

## 10. Token discipline

- One stage (or smaller task) per session. When done, suggest the user run `/clear` or open a new session.
- Read files by exact path; grep before reading whole files.
- Report only failing output from tests and builds.
- Don't paste docs back to the user; refer to the path.
