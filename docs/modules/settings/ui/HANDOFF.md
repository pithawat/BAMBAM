# UI handoff — ตั้งค่าระบบ (Superadmin)

Status: NOT READY — specs only (Claude sets `READY FOR CODEX — Stage <n>` in /build-stage prepare; Codex sets `UI DONE — Stage <n>, waiting for Claude wire`)

<!-- Written by Claude (/ui-spec settings 2026-10-16, updated by /build-stage prepare). Codex starts here.
     Only build the screens of the current stage. -->

## Read in this order

1. `frontend/AGENTS.md` (rules)
2. `docs/shared/design-system.md` (tokens, components, patterns)
3. `docs/modules/repair/ui/screens/_common.md` §1, §3, §6 (shell, dates, shared state copy) — still apply
4. `ui/screens/_common.md` (settings: access, nav, labels, `MasterList`, dialogs, messages, sample data)
5. Screen specs for this stage (below)
6. Mockups next to them (open the .html in a browser; the S24 matrix is clickable)
7. `frontend/src/modules/settings/types.ts` and `mocks.ts` (data shapes — do not change)

## Screens

| Screen | Spec | Mockup | Route | Stage |
|---|---|---|---|---|
| S19 ตั้งค่าระบบ | `screens/S19-settings-home.md` | — (S24 shell) | `/settings` | 1 |
| S24 Role และสิทธิ์ | `screens/S24-roles-permissions.md` | `mockups/S24-roles-permissions.html` | `/settings/roles` | 2 |
| S25 ผู้ใช้ | `screens/S25-users.md` | `mockups/S25-users.html` | `/settings/users` | 3 |
| S26 ประวัติการเปลี่ยนแปลง | `screens/S26-audit-log.md` | — (S25 table) | `/settings/audit` | 3 |
| S20 อาคารและชั้น | `screens/S20-buildings.md` | `mockups/S20-buildings.html` | `/settings/buildings[/[buildingId]]` | 4 |
| S21 รายละเอียดชั้น | `screens/S21-floor-detail.md` | `mockups/S20-buildings.html` §3–4 | `/settings/buildings/[buildingId]/floors/[floorId]` | 4 |
| S22 หมวดงานและอาการ | `screens/S22-categories.md` | — (S20 pattern) | `/settings/categories[/[categoryId]]` | 5 |
| S23 ประเภทผู้รับเหมา | `screens/S23-contractor-types.md` | — (`MasterList`) | `/settings/contractor-types` | 5 |

## You may edit

- `frontend/src/app/(app)/settings/**`
- `frontend/src/modules/settings/components/**`
- `frontend/src/components/ui/**` only via `npx shadcn@latest add` (Stage 2 needs `checkbox`, `switch`, `dropdown-menu`)
- This file: checklist and "Open questions" only

## Do not edit

- `backend/**`, `docs/**` (except this file), `modules/settings/{types,mocks,api}.ts`, `src/proxy.ts`, `src/lib/**`
- `components/shared/**` (sidebar, bottom nav, role switcher, `category-icon.ts` are Claude's in these stages) — write needs in Open questions
- `modules/repair/**`

## Run

```
cd frontend
npm run dev          # NEXT_PUBLIC_USE_MOCKS=true in .env.development; mock role super_admin via the role switcher
npm run lint && npm run typecheck
```

## Done when

- [ ] Every item in each screen's acceptance checklist passes (record below)
- [ ] lint + typecheck pass
- [ ] Each screen compared with its mockup / referenced pattern at 375px and 1280px; differences listed below

## Checklist results (Codex fills)

| Screen | All checklist items pass? | Notes |
|---|---|---|
| | | |

## Differences from mockup (Codex fills)

-

## Open questions (Codex fills — never guess)

-
