# UI handoff — <Module name> — Stage <n>

Status: NOT READY — specs only (Claude sets `READY FOR CODEX — Stage <n>` in /build-stage prepare; Codex sets `UI DONE — Stage <n>, waiting for Claude wire`)

<!-- Written by Claude (/ui-spec, updated by /build-stage prepare). Codex starts here. -->

## Read in this order

1. `frontend/AGENTS.md` (rules)
2. `docs/shared/design-system.md` (tokens, components, patterns)
3. Screen specs for this stage (below)
4. Mockups next to them (open the .html in a browser)
5. `frontend/src/modules/<m>/types.ts` and `mocks.ts` (data shapes — do not change)

## Screens in this stage

| Screen | Spec | Mockup | Route |
|---|---|---|---|
| S01 | `screens/S01-*.md` | `mockups/S01-*.html` | |

## You may edit

- `frontend/src/app/(app)/<m>/**`
- `frontend/src/modules/<m>/components/**`
- `frontend/src/components/ui/**` only via `npx shadcn@latest add`
- This file: checklist and "Open questions" only

## Do not edit

- `backend/**`, `docs/**` (except this file), `modules/<m>/{types,mocks,api}.ts`, `src/proxy.ts`, `src/lib/**`
- `components/shared/**` — if you need a change there, write it in Open questions

## Run

```
cd frontend
npm run dev          # NEXT_PUBLIC_USE_MOCKS=true in .env.development
npm run lint && npm run typecheck
```

## Done when

- [ ] Every item in each screen's acceptance checklist passes (record below)
- [ ] lint + typecheck pass
- [ ] Each screen compared with its mockup at 375px and 1280px; differences listed below

## Checklist results (Codex fills)

| Screen | All checklist items pass? | Notes |
|---|---|---|
| S01 | | |

## Differences from mockup (Codex fills)

-

## Open questions (Codex fills — never guess)

-
