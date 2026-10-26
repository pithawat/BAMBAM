# UI handoff — ตั้งค่าระบบ (Admin / Superadmin)

Status: ACCEPTED — Stage 1 (2026-10-26, tag `settings-stage-1`). Codex has nothing to build until Stage 2 prepare. Before: WIRED · real API + e2e `e2e/settings/F25-settings-entry.spec.ts` · before: UI DONE (built by Claude at the owner's request, D-114)

<!-- Written by Claude (/ui-spec settings 2026-10-16, updated by /build-stage prepare). Codex starts here.
     Only build the screens of the current stage. -->

## Read in this order

1. `frontend/AGENTS.md` (rules)
2. `docs/shared/design-system.md` (tokens, components, patterns)
3. `docs/modules/repair/ui/screens/_common.md` §1, §3, §6 (shell, dates, shared state copy) — still apply
4. `ui/screens/_common.md` (settings: access, nav, labels, `MasterList`, dialogs, messages, sample data)
5. Screen specs for this stage (below)
6. (CR-001) The approved design `ui/mockups/CR-001-admin-settings.html` (open in a browser; `?viewer=admin`, `?state=loading|empty|error|forbidden`, `#users|#roles|#places|#categories`, `?tab=types#places`) and its review notes `ui/mockups/CR-001-design.md`. It supersedes the older `S20` / `S24` / `S25` mockups. The "มุมมองตัวอย่าง" controls and the prototype's browser-memory data are review tools only.
7. `frontend/src/modules/settings/types.ts`, `mocks.ts` and `nav.ts` (data shapes, navigation and access rules — do not change)

## Screens

| Screen | Spec | Mockup | Route | Stage |
|---|---|---|---|---|
| Administration shell (CR-001) | `screens/_common.md` §1–§2 | `mockups/CR-001-admin-settings.html` (sidebar, drawer, heading + mascot) | `app/(app)/settings/layout.tsx`, `/settings` → `/settings/buildings` | 1 |
| ~~S19 ตั้งค่าระบบ~~ | removed (CR-001) | | | |
| S24 Role และสิทธิ์ | `screens/S24-roles-permissions.md` (+ CR-001 block) | `mockups/CR-001-admin-settings.html#roles` | `/settings/roles` | 2 |
| S25 ผู้ใช้ | `screens/S25-users.md` (+ CR-001 block) | `mockups/CR-001-admin-settings.html#users` | `/settings/users` | 3 |
| S26 ประวัติการเปลี่ยนแปลง | `screens/S26-audit-log.md` (+ CR-001 block) | — (CR-001 users panel/table pattern) | `/settings/audit` | 3 |
| S20 อาคารและอุปกรณ์ (CR-002) | `screens/S20-buildings.md` (rewritten) | `mockups/CR-001-admin-settings.html#places`, `?tab=types#places` | `/settings/buildings` (`?tab=asset-types`) | 4 |
| ~~S21 รายละเอียดชั้น~~ | removed (CR-002) | | | |
| S22 หมวดงานและอาการ | `screens/S22-categories.md` (+ CR-001 block) | `mockups/CR-001-admin-settings.html#categories` | `/settings/categories[/[categoryId]]` | 5 |
| S23 ประเภทผู้รับเหมา | `screens/S23-contractor-types.md` (+ CR-001 block) | — (`MasterList` in a CR-001 panel) | `/settings/contractor-types` | 5 |

Known differences from the design that are intentional (CR-001 apply, 2026-10-26): asset type form adds รหัสนำหน้า + ตำแหน่งติดตั้ง (owner); asset type cannot change on edit and inactive assets only offer เปิดใช้งาน (approved repair rules); S22 row menus add เลื่อนขึ้น / เลื่อนลง / ลบ (approved rules); sidebar adds ประเภทผู้รับเหมา and ประวัติการเปลี่ยนแปลง for Superadmin (owner); dev/UAT keep the existing role switcher instead of the prototype's review controls.

## Stage 1 — administration shell (build this now)

Only the shell and placeholder pages. No S20 / S22–S26 content yet (Stages 2–5).

**Use these (Claude's, read-only for you):**

| Need | Use |
|---|---|
| Current user | `useCurrentUser()` from `components/shared/me-provider` (`me.name`, `me.roleName`, `me.permissions`) |
| Sidebar / drawer groups and items | `settingsNav(me)` from `modules/settings/nav.ts` — already filtered by permission, empty groups removed; items with `soon: true` are static (badge "เร็ว ๆ นี้", not a link); "แจ้งซ่อม" already points to the user's repair start route |
| Active item | `settingsPageOf(pathname)` === `item.page` (and `/` / repair items never active on settings pages) |
| Page access | `settingsAccess(me, pathname)` → when `allowed` is false render `<ForbiddenState title={a.title} reason={a.reason} action={a.action} />` (new optional `action` prop; omitted = "กลับหน้าแรก") **and nothing else of the page** |
| No settings permission at all | `canAnySettings(me)` from `lib/platform/permissions` is false → full-page Forbidden (same `settingsAccess` copy), **no sidebar** |
| Heading mascot | `settingsMascot(me)` → `{ src, alt: "" }` (112px desktop / 72px mobile, `next/image`) |
| Logo | `/brand/bam-logo.webp`, 104px wide, `alt="BAMBAM"` + muted label "ตั้งค่าระบบ" |
| Role switcher (dev/UAT) | `<RoleSwitcher className=… />` from `components/shared/role-switcher` at the bottom of the sidebar / drawer (it renders nothing in production) |
| Icons | `item.icon` (lucide component) |

The app shell (`components/shared/app-shell.tsx`) already drops the role-switcher strip, the navbar and the width frame on `/settings/**`; your `layout.tsx` owns the whole page. `/settings` itself is a redirect to `/settings/buildings` (`app/(app)/settings/page.tsx`, Claude's — do not edit).

**Build:**

- [x] `app/(app)/settings/layout.tsx` (client): sidebar ≥ 1024px (fixed ~232px, near-white, right border, no card frames; identity → groups → spacer → role switcher), drawer < 1024px (`Sheet` side left, dim overlay, close button `X` aria-label "ปิดเมนู" beside the logo, focus trapped, Escape / overlay / navigating closes it and focus returns to the menu button) — `_common.md` §2 and the design (`mockups/CR-001-admin-settings.html`, also `?viewer=admin`)
- [x] Group labels Small muted; active item `bg-secondary` + primary text + `aria-current="page"`; items ≥ 44px
- [x] Page heading component `modules/settings/components/settings-heading.tsx`: H1 + one-line muted subtitle, optional primary action right-aligned on the same row, mascot beside the title, and on < 1024px the menu button (`Menu`, 44px, aria-label "เปิดเมนูหลัก") left of the title that opens the drawer (share the drawer state through the layout, e.g. a small context in `modules/settings/components/`)
- [x] Quiet gray canvas, white bordered panels (`web ui style/manage user.png`); no top bar, breadcrumbs, bell or account avatar on settings pages; no bottom nav
- [x] Placeholder `page.tsx` for each sidebar page — heading + one white panel with `EmptyState` title "ส่วนนี้กำลังพัฒนา", hint "เปิดใช้ได้ในรอบถัดไป" (temporary until its stage; no data calls). Headings:

| Route | Title | Subtitle |
|---|---|---|
| `/settings/buildings` | อาคารและอุปกรณ์ | เลือกห้องจากผัง แล้วจัดการอุปกรณ์ที่ติดตั้งในห้องนั้น |
| `/settings/categories` | หมวดงานและอาการ | จัดระเบียบหมวดงาน อาการ และความเร่งด่วนของงานแจ้งซ่อม |
| `/settings/contractor-types` | ประเภทผู้รับเหมา | ประเภทที่ช่างเลือกตอนประเมินงาน ช่างเพิ่มประเภทใหม่เองได้ด้วย |
| `/settings/users` | ผู้ใช้ | จัดการบทบาทของทุกคนที่เข้าใช้ BAMBAM ผ่าน SSO |
| `/settings/roles` | Role และสิทธิ์ | กำหนดว่าแต่ละบทบาททำอะไรได้ใน BAMBAM |
| `/settings/audit` | ประวัติการเปลี่ยนแปลง | ทุกการเปลี่ยนในตั้งค่าระบบ ใครทำ เมื่อไหร่ เปลี่ยนจากอะไรเป็นอะไร · ไม่มีการลบประวัติ |

- [x] Access in the layout (or each page) via `settingsAccess` — Admin opening `/settings/users`, `/settings/roles`, `/settings/audit`, `/settings/contractor-types` sees Forbidden with "ไปที่อาคารและอุปกรณ์"; พนักงาน sees the full-page Forbidden
- [x] `loading.tsx` / `error.tsx` for `app/(app)/settings` (error copy `_common.md` §6 "Whole page failed (CR-001 copy)")
- [x] Check at 1280px and 375px in mock mode: role switcher → Superadmin (every item, guardian mascot), Admin (บริการ + อาคารและอุปกรณ์ · หมวดงานและอาการ, planner mascot), พนักงานทั่วไป (Forbidden), หัวหน้าช่าง (custom role: Forbidden)

**Acceptance (from `03-plan.md` Stage 1, UI part):** AC1b (Admin sidebar + Forbidden pages), AC2 (other roles Forbidden "คุณไม่มีสิทธิ์เข้าถึงหน้านี้"), AC2b (1280 / 375: sidebar ↔ drawer, Escape closes and focus returns, mascot per role, logo in sidebar and drawer, no top bar).

## You may edit

- `frontend/src/app/(app)/settings/**` (incl. `layout.tsx` = administration shell, CR-001)
- `frontend/src/modules/settings/components/**`
- `frontend/src/components/ui/**` only via `npx shadcn@latest add` (Stage 2 needs `checkbox`, `switch`, `dropdown-menu`)
- This file: checklist and "Open questions" only

## Do not edit

- `backend/**`, `docs/**` (except this file), `modules/settings/{types,mocks,api,nav}.ts`, `app/(app)/settings/page.tsx`, `src/proxy.ts`, `src/lib/**`
- `components/shared/**` (navbar, bottom nav, role switcher, `category-icon.ts`, `asset-icon.ts` are Claude's in these stages) — write needs in Open questions
- `modules/repair/**`

## Run

```
cd frontend
npm run dev          # NEXT_PUBLIC_USE_MOCKS=true in .env.development; mock role Superadmin / Admin / หัวหน้าช่าง via the role switcher
                     # settings mock scenarios: ?mock=normal|empty|error|forbidden|slow
npm run lint && npm run typecheck
```

## Done when

- [ ] Every item in each screen's acceptance checklist passes (record below)
- [ ] lint + typecheck pass
- [ ] Each screen compared with its mockup / referenced pattern at 375px and 1280px; differences listed below

## Checklist results (Codex fills)

| Screen | All checklist items pass? | Notes |
|---|---|---|
| Administration shell (Stage 1, Claude) | ✅ (mock mode) | 1280px: Superadmin all items + guardian mascot; Admin บริการ + ข้อมูลกลาง (2 items), planner mascot, `/settings/users` Forbidden + "ไปที่อาคารและอุปกรณ์"; พนักงาน full-page Forbidden. 375px: drawer opens from "เปิดเมนูหลัก", Escape closes, focus back on the menu button. `/settings` → `/settings/buildings`. lint, typecheck, build pass. Components: `modules/settings/components/settings-{shell,heading,placeholder}.tsx` | | |

## Differences from mockup (Codex fills)

- Sidebar items have no card frame around each group (spec §2 "no card frames around items"; the prototype CSS has a light frame, its screenshots do not).
- Forbidden state uses the shared `ForbiddenState` (mascot) inside a white panel instead of the prototype's lock-icon panel.
- No workspace footer ("BAMBAM · Workplace Service Assistant / ข้อมูลตัวอย่างสำหรับตรวจแบบ") — review-only in the prototype.
- Role switcher (dev/UAT) = a two-line amber block at the sidebar bottom (`RoleSwitcher variant="sidebar"`) instead of the prototype's "มุมมองตัวอย่าง".

## Open questions (Codex fills — never guess)

- Stage 1: none.
