# S## — <Screen name>

Status: DRAFT

- **Flows:** F01 step 2 (see ../../02-flows.md)
- **Persona:** <name> on <device> (see ../../01-users.md)
- **Purpose of this screen (one sentence):**
- **Route:** `/(app)/<module>/<path>`
- **Mockup:** `../mockups/S##-<slug>.html` (if any)
- **Data:** endpoints from ../../04-api-contract.md → `modules/<m>/api.ts` functions

## Layout — mobile first

```
┌──────────────────────────┐
│ PageHeader: title  [act] │
│ ┌──────┐┌──────┐┌──────┐ │
│ │ stat ││ stat ││ stat │ │
│ └──────┘└──────┘└──────┘ │
│ list item ............ > │
│ list item ............ > │
│                          │
│ [   Primary action     ] │ ← sticky bottom on mobile
└──────────────────────────┘
```

Desktop (≥1024px):

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| | | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | |
| Primary button | |
| Empty state | |
| Error codes → message | see 04-api-contract.md error table |

## States

| State | What shows |
|---|---|
| Loading | |
| Empty | |
| Error | |
| Forbidden | |
| Success feedback | |

## Interactions

- Tap/click … → …
- Validation (field → rule → message):

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches layout and mockup at 375px and 1280px
- [ ] Uses only design-system tokens and shadcn components
- [ ] All states above implemented with the exact copy
- [ ] Keyboard and screen-reader basics (labels, focus order)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
