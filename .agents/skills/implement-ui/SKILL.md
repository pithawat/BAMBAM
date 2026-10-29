---
name: implement-ui
description: Implement a module's screens for one stage from docs/modules/<module>/ui/HANDOFF.md, using the screen specs, HTML mockups and the design system. Use when asked to build or fix UI for a stage.
---

0. Read `docs/modules/<module>/PROGRESS.md`. If the `Status:` line of `HANDOFF.md` is not `READY FOR CODEX` for the requested stage, stop and tell the user to run `/build-stage <module> <n> prepare` in Claude Code first.
1. Open `docs/modules/<module>/ui/HANDOFF.md` and read every file in its "Read in this order" list. Edit only the paths under "You may edit".
2. For each screen in this stage:
   - build it from its spec using shadcn/ui components and design tokens only (no hex colors, no arbitrary values)
   - get data only through `modules/<module>/api.ts` with `NEXT_PUBLIC_USE_MOCKS=true`; use the named mock scenarios to render every state
   - implement every state (loading, empty, error, forbidden) with the exact Thai copy from the spec
3. Compare each screen with its mockup at 375px and 1280px (browser or Playwright screenshot). Fix differences; list any that remain under "Differences from mockup" in HANDOFF.md.
4. Run `npm run lint` and `npm run typecheck` in `frontend/`.
5. Fill "Checklist results" in HANDOFF.md.
6. Anything unclear, or a needed change to types, mocks, api, shared components or backend → write it under "Open questions". Never guess and never edit those files.

7. Set the HANDOFF `Status:` line to `UI DONE — Stage <n>, waiting for Claude wire`.

Finish with a short summary: screens done, lint/typecheck result, remaining differences, open questions, and tell the user the next step: run `/build-stage <module> <n> wire` in Claude Code.
