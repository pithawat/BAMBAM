# UI handoff — ตั้งค่าระบบ (Admin / Superadmin)

Status: UI DONE + WIRED — Stages 2–5 (2026-10-26, built by Claude per D-115; waiting for owner acceptance). Before: ACCEPTED — Stage 1 (2026-10-26, tag `settings-stage-1`)

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

## Stage 2 — S24 Role และสิทธิ์ (build this now)

Only `/settings/roles`. Every other settings page keeps its placeholder (S25 / S26 are Stage 3).

**Spec and design:** `screens/S24-roles-permissions.md` — the **CR-001 block wins** where it differs from the older layout / copy below it (card names, "Role" with capital R, tabs ตารางสิทธิ์ · รายการ Role {n}, button "เพิ่ม Role", save bar "เปลี่ยนสิทธิ์ {n} รายการ" · ยกเลิกการเปลี่ยนแปลง · **บันทึกสิทธิ์**, the fixed "ตั้งค่าระบบ" card, the priority note under the matrix). Visual: `mockups/CR-001-admin-settings.html#roles` and `mockups/CR-001-assets/roles-{desktop,mobile}.png`.

**Use these (Claude's, read-only for you):**

| Need | Use |
|---|---|
| Page access | `settingsAccess(me, "/settings/roles")` as in Stage 1 (Superadmin only; others get Forbidden) |
| Heading | `SettingsHeading` (Stage 1) with title "Role และสิทธิ์", subtitle from `nav.ts`, primary action "เพิ่ม Role" |
| Matrix | `getPermissionMatrix()` → `PermissionMatrix`: `systems → groups → permissions` (cards and columns, in order) and `roles` (rows, in order, `permissions` = ticked keys incl. fixed). **Render cards / columns from this data — do not hard-code keys or labels.** Column ⓘ tooltip = `permission.description` |
| Locked cells | `group.isFixed` → every cell of that card disabled + card note `Lock` "กำหนดโดยระบบ" (mobile: switch disabled, "· กำหนดโดยระบบ"); `role.isLocked` (Superadmin) → its whole row disabled + `Lock` on the row header |
| Save matrix | `savePermissionMatrix({ version: matrix.version, changes })` — `changes` = only cells that differ from the loaded matrix (`{ roleId, permission, granted }`). Response = the new matrix: replace state, clear pending, toast "บันทึกสิทธิ์แล้ว" |
| Save dialog content | per role with changes: `role.name`, `role.userCount`, added / removed = `permission.label`s from the matrix |
| Conflict (AC5) | `ApiError.code === "VERSION_CONFLICT"` → call `getPermissionMatrix()`, show the warning `Alert` in the dialog with `fresh.updatedBy?.name` and `fresh.updatedAt` (date format: repair `_common.md` §3). "โหลดข้อมูลล่าสุด" → take the fresh matrix, re-apply your pending changes on top (drop any that now equal the fresh value), close the dialog, toast "โหลดข้อมูลล่าสุดแล้ว ตรวจการเปลี่ยนแปลงอีกครั้งก่อนบันทึก" |
| Role list tab | `getRoles()` → `Role[]` (`isSystem` → badge `Lock` "Role ระบบ", no ลบ; `isLocked` → no แก้ไข either, menu hidden). "{n} คน" links to `/settings/users?role={role.id}` (S25 arrives in Stage 3) |
| Add Role | `createRole({ name, description, copyFromRoleId })` (`null` = สิทธิ์พื้นฐานเท่านั้น). Copy-from options = every role from `getRoles()`. On success: toast `เพิ่ม Role "{ชื่อ}" แล้ว`, refetch matrix + roles, scroll the new row (`id` from the response) into view and flash it `bg-secondary` 1.5s |
| Edit Role | `updateRole(id, { name?, description?, updatedAt: role.updatedAt })` — send only changed fields; toast "บันทึกแล้ว"; refetch roles + matrix (names show in the matrix too) |
| Delete Role | `role.userCount > 0` → the blocked dialog straight away (no call). Otherwise confirm → `deleteRole(id)` → toast `ลบ Role "{ชื่อ}" แล้ว`, refetch. If the call still returns `ROLE_IN_USE`, refetch roles and show the blocked dialog with the fresh count |
| Unsaved guard | pending matrix changes + navigating away (sidebar links, browser back, `beforeunload`) → `_common.md` §5 dialog "ออกโดยไม่บันทึก?". Switching tabs keeps pending changes. Share the dirty flag with the shell through a small context in `modules/settings/components/` |
| Tabs in the URL | `?tab=permissions` (default) · `?tab=roles` |
| Checkbox / switch / menu | `components/ui/checkbox`, `switch`, `dropdown-menu` (added by Claude via shadcn); `Select` for the mobile role picker and the copy-from picker |

**Error copy** (`ApiError` from `lib/http`; codes in `04-api-contract.md` → Error codes):

| Code | Where | Show |
|---|---|---|
| `VALIDATION_FAILED` `fields.name` `REQUIRED` / `TOO_LONG` | role dialog, under ชื่อ Role | กรุณากรอกชื่อ role · ชื่อยาวได้ไม่เกิน 50 ตัวอักษร (check on the client too) |
| `fields.description` `TOO_LONG` | under คำอธิบาย | คำอธิบายยาวได้ไม่เกิน 200 ตัวอักษร |
| `fields.copyFromRoleId` `INVALID` | under the copy picker | กรุณาเลือก role ที่จะคัดลอก (also client-side when "คัดลอกจาก" is chosen without a role) |
| `NAME_TAKEN` | under ชื่อ Role | ชื่อนี้มีอยู่แล้ว |
| `VERSION_CONFLICT` on edit Role | toast + refetch | ข้อมูลนี้ถูกแก้โดย {updatedBy.name} เมื่อ {เวลา} (from the refetched role) |
| `ROLE_IN_USE` | delete | the blocked dialog |
| `ROLE_NOT_FOUND` | any | refetch matrix + roles, toast ทำรายการไม่สำเร็จ ลองอีกครั้ง |
| anything else (`SYSTEM_ROLE`, `UNKNOWN_PERMISSION`, `FIXED_PERMISSION`, 5xx, network) | | toast ทำรายการไม่สำเร็จ ลองอีกครั้ง; dialogs stay open, pending changes kept |

**Mock mode** (`NEXT_PUBLIC_USE_MOCKS=true`): the matrix and roles live in memory (reset on reload) and follow the API rules — Admin has 2 users (delete → `ROLE_IN_USE`), "หัวหน้าช่าง" has 0 (delete works; it also makes "หัวหน้าช่าง" a taken name until deleted), duplicate names → `NAME_TAKEN`. Scenarios `?mock=normal|error|forbidden|slow|conflict` — `conflict`: the first matrix save returns `VERSION_CONFLICT` as if ปวีณา ศรีสุข saved first; `error`: reads and writes fail. `empty` does not apply (system roles always exist). The mock role switcher does not list roles you create (the real API does).

**Build:**

- [ ] `app/(app)/settings/roles/page.tsx` + components in `modules/settings/components/` (e.g. `roles/permission-matrix.tsx`, `roles/role-list.tsx`, `roles/role-dialog.tsx`, …)
- [ ] Tab ตารางสิทธิ์ desktop (≥ 1024px): info strip, system headings, one card per group (rows = roles "{name}" + "{n} คน", columns = permissions with ⓘ), changed cells soft-blue, sticky save bar only when dirty, save dialog, conflict path
- [ ] Tab ตารางสิทธิ์ mobile (< 1024px): role `Select` "เลือก Role ที่ต้องการตั้งค่า" (options "{role} · {n} คน") + one card per group with a `Switch` per permission (label + description); pending changes of other roles stay and count in the save bar
- [ ] Tab รายการ Role {n}: table desktop / cards mobile, row menu แก้ไข Role · ลบ Role per the rules above
- [ ] Add / edit Role dialog (`Dialog` desktop, bottom `Sheet` mobile), delete dialogs (two variants)
- [ ] States: loading skeleton (tabs + info strip + 3 cards × 7 rows), whole-page error (`_common.md` §6), Forbidden, saving (spinner + disabled primary)
- [ ] Accessible names: checkbox / switch "{permission label} — {role name}"; ⓘ button "คำอธิบาย {label}"; every control reachable by Tab
- [ ] Check at 1280px and 375px in mock mode, scenarios normal / conflict / error / slow, and as Admin (Forbidden)

**Acceptance (from `03-plan.md` Stage 2, UI part, in mock mode):** AC1 (three cards with default ticks, Superadmin row ticked + disabled — with CR-001 that is two repair cards "งานแจ้งซ่อม" · "งานทีมและช่างภายนอก" plus the fixed card), AC1b (ตั้งค่าระบบ card: Admin ticked for อาคารและห้อง · อุปกรณ์และประเภทอุปกรณ์ · หมวดงานและอาการ only, Superadmin all, others none, every cell disabled), AC2 (untick ช่างเทคนิค → จัดการช่างภายนอก, dialog lists "ช่างเทคนิค · ผู้ใช้ 1 คน / ถอด: จัดการช่างภายนอก"), AC3 (add Role copied from ช่างเทคนิค → new row highlighted with the same ticks), AC4 (delete Admin → blocked "มีผู้ใช้ 2 คน…"; delete a 0-user role works), AC5 (`?mock=conflict`), AC6 (leave with unsaved changes asks; mobile switches + save bar). The real-API checks (permissions applying on the next request, role switcher) are Claude's in wire.

## Stage 1 — administration shell (done, accepted 2026-10-26)

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
- `frontend/src/components/ui/**` only via `npx shadcn@latest add` (`checkbox`, `switch`, `dropdown-menu` are already added for Stage 2)
- This file: checklist and "Open questions" only

## Do not edit

- `backend/**`, `docs/**` (except this file), `modules/settings/{types,mocks,api,nav}.ts`, `app/(app)/settings/page.tsx`, `src/proxy.ts`, `src/lib/**`
- `components/shared/**` (navbar, bottom nav, role switcher, `category-icon.ts`, `asset-icon.ts` are Claude's) — write needs in Open questions
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
| S24 Role และสิทธิ์ (Stage 2, Claude) | ✅ (mock + real API) | 1280px / 375px checked in mock mode (normal, conflict path, blocked delete, NAME_TAKEN); real API via `e2e/settings/F29-roles-matrix.spec.ts`. Components: `modules/settings/components/roles/{roles-screen,permission-matrix,role-list,role-dialogs}.tsx`, helpers `settings-ui.ts` |
| S25 ผู้ใช้ · S26 ประวัติการเปลี่ยนแปลง (Stage 3, Claude) | ✅ (mock + real API) | 1280 / 375 in mock mode; real API via `e2e/settings/F15-change-role.spec.ts`, `F30-audit.spec.ts`. Components: `modules/settings/components/users/*`, `audit/audit-screen.tsx` |
| S20 อาคารและอุปกรณ์ (Stage 4, Claude) | ✅ (mock + real API) | 1280 / 375 in mock mode (navigator, asset panel, asset dialog with inline type, types tab); real API via `e2e/settings/F26-places-assets.spec.ts`. Components: `modules/settings/components/places/*`; shared `components/shared/asset-icon.ts` |
| S22 หมวดงานและอาการ · S23 ประเภทผู้รับเหมา (Stage 5, Claude) | ✅ (mock + real API) | 1280 / 375 in mock mode; real API via `e2e/settings/F27-categories.spec.ts`, `F28-contractor-types.spec.ts`. Components: `modules/settings/components/{categories,contractor-types}/*`, `confirm-dialog.tsx`; shared `components/shared/category-icon.ts` (repair S03 / S06 / S07 tiles use it) |
| Administration shell (Stage 1, Claude) | ✅ (mock mode) | 1280px: Superadmin all items + guardian mascot; Admin บริการ + ข้อมูลกลาง (2 items), planner mascot, `/settings/users` Forbidden + "ไปที่อาคารและอุปกรณ์"; พนักงาน full-page Forbidden. 375px: drawer opens from "เปิดเมนูหลัก", Escape closes, focus back on the menu button. `/settings` → `/settings/buildings`. lint, typecheck, build pass. Components: `modules/settings/components/settings-{shell,heading,placeholder}.tsx` | | |

## Differences from mockup (Codex fills)

Stage 2 (S24):

- Mobile role list menu has แก้ไข Role · ลบ Role only (the older spec's "ดูผู้ใช้" item is the "{n} คน" link on the card).
- Add Role "เริ่มต้นสิทธิ์" is one picker (สิทธิ์พื้นฐานเท่านั้น / คัดลอกจาก {Role}) as in the CR-001 block, not the older segmented control + second picker; the "กรุณาเลือก Role ที่จะคัดลอก" case only comes from the server.
- Role copy uses "Role" (capital R) everywhere, incl. validation lines (CR-001 spelling rule).
- No workspace footer (review-only in the prototype), as in Stage 1.

Stage 5 (S22 / S23):

- The category icon picker offers the 12 S22 icons plus the 4 repair CR-014 master icons (presentation, building-2, square-parking, ellipsis) so seeded categories keep their icon when edited; the API accepts the same 16.
- Category area types (CR-014) are toggle pills under ความเร่งด่วนตั้งต้น (not in the design, as the spec says).
- S22 detail is one page for both sizes (`/settings/categories/{id}` selects the category; panels stack on phones) instead of a separate mobile symptom page.
- "แสดงที่ปิดใช้งาน" also shows inactive symptoms of the selected category.

Stage 4 (S20):

- Section tabs are underline tabs with icons (as the design screenshots), not the segmented control named in the spec table.
- Selects are the shadcn `Select` (design uses native selects); floor buttons read "ชั้น {name}".
- S29 keeps its 3D asset markers on the seeded key → icon map for assets of types without a stored icon in #30 (the palette uses the type's stored icon).

Stage 3 (S25 / S26):

- S25 detail is a dialog / bottom sheet (CR-001 block), not the older right-side sheet; the role filter is a `Select` "Role: ทั้งหมด" with "{role} · {n} คน" options.
- S25 copy uses "Role" (capital R) in the lock reasons and errors (CR-001 spelling rule).
- S26 date range lives in the URL as `?range=7|30|90|all` (default 30 วัน) instead of `from` / `to`; the API still receives `from`.
- S26 filters are `Select`s, not `FilterPill`s; on phones they sit in the toolbar instead of a "ตัวกรอง" sheet.
- S26 "รายการ" links: room / asset → S20, asset type → S20 `?tab=asset-types`, category → S22; floors / symptoms have no own page and are not linked.

Stage 1 (shell):

- Sidebar items have no card frame around each group (spec §2 "no card frames around items"; the prototype CSS has a light frame, its screenshots do not).
- Forbidden state uses the shared `ForbiddenState` (mascot) inside a white panel instead of the prototype's lock-icon panel.
- No workspace footer ("BAMBAM · Workplace Service Assistant / ข้อมูลตัวอย่างสำหรับตรวจแบบ") — review-only in the prototype.
- Role switcher (dev/UAT) = a two-line amber block at the sidebar bottom (`RoleSwitcher variant="sidebar"`) instead of the prototype's "มุมมองตัวอย่าง".

## Open questions (Codex fills — never guess)

- Stage 2: none.
- Stage 1: none.
