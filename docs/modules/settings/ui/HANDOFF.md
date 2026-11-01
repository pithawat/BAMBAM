# UI handoff — ตั้งค่าระบบ (Admin / Superadmin)

Status: ACCEPTED — Stage R1 (2026-11-01, built and wired by Claude, D-133 / D-134, tag `settings-stage-R1`). Before: ACCEPTED — Stages 1–6 (2026-10-27) and 4P (2026-10-29, tags `settings-stage-1`…`6`, `settings-stage-4P`)

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
| S20 tab ประเภทอาคาร + แก้ไขอาคาร · S22 ใช้กับประเภทอาคาร · S26 labels (CR-005) | `screens/S20-buildings.md`, `screens/S22-categories.md` (CR-005 blocks) | — (S20 `ประเภทอุปกรณ์` tab pattern; S22 dialog) | `/settings/buildings?tab=building-types`, `/settings/categories` | 4P |
| S24 / S25 permission changes, navbar + Home service visibility (CR-006) | `../changes/CR-006.md`, S24 / S25 CR-006 blocks | — | `/settings/roles`, `/settings/users`, `/` | R1 |
| Settings redesign + S26 pagination (CR-006) | `screens/_common.md` §2 CR-006 block, S20 / S22–S26 CR-006 blocks | `mockups/CR-006-design/App.tsx` + `index.css` (layout only; tokens from `design-system.md`) | all `/settings/**` | R2 |

Known differences from the design that are intentional (CR-001 apply, 2026-10-26): asset type form adds รหัสนำหน้า + ตำแหน่งติดตั้ง (owner); asset type cannot change on edit and inactive assets only offer เปิดใช้งาน (approved repair rules); S22 row menus add เลื่อนขึ้น / เลื่อนลง / ลบ (approved rules); sidebar adds ประเภทผู้รับเหมา and ประวัติการเปลี่ยนแปลง for Superadmin (owner); dev/UAT keep the existing role switcher instead of the prototype's review controls.

## Stage R1 — สิทธิ์ทั้งแพลตฟอร์ม (CR-006) (built by Claude 2026-11-01, D-133)

Changes to the built S24, S25 and Home (`/`) only. Keep today's layout and look — the CR-006 restyle is Stage R2. Everything else stays as accepted.

**Spec:** `../changes/CR-006.md` (catalog, defaults, guard rules G1–G3), the **CR-006 blocks** at the top of `screens/S24-roles-permissions.md` and `screens/S25-users.md`, and the copy below (use it word for word). Contract: `../04-api-contract.md` → "Stage R1 shapes and rules (CR-006)".

**Already done by Claude (read-only for you):** API + mocks (G1–G3 in mock mode too), `lib/platform/permissions.ts` (`canReport`, `sees3D`, `seesUsers`, `usesService`), navbar services by permission, `/car-booking` · `/room-booking` Forbidden without `*.use`, `/repair/new` Forbidden without `report` (team mode keeps `team_handle`), report CTAs in repair S06 / S05, S29 floor list without 3D, `nav.ts` (ผู้ใช้ opens with `users.view` or `users.manage`; services filtered), `/settings` → first allowed page. Placeholder copy `LOCK_COPY.READ_ONLY` / `SUPER_ADMIN` in `users/user-bits.tsx` keeps the build green — keep the strings.

**Use these:**

| Need | Use |
|---|---|
| Matrix cards | `getPermissionMatrix()` — now **3 systems** (ระบบแจ้งซ่อม: การใช้บริการแจ้งซ่อม · งานแจ้งซ่อม · งานทีมและช่างภายนอก; การเข้าใช้บริการ: ระบบจองรถและห้องประชุม; ตั้งค่าระบบ). Render from data as today. The ตั้งค่าระบบ card is **no longer fixed** (`isFixed: false`) — its cells are tickable like the others (keep the `isFixed` branch for safety) |
| Cell disabled — row | `role.isLocked` (Superadmin, as today) **or** `role.guard` set. Row header: `Lock` + reason `OWN_ROLE` → `แก้สิทธิ์ของ role ตัวเองไม่ได้` · `SUPER_ADMIN` → as today's Superadmin row |
| Cell disabled — column | `!matrix.grantable.includes(permission.key)` → every row's cell of that key disabled; tooltip / mobile hint `ให้ได้เฉพาะสิทธิ์ที่คุณมี`. Superadmin gets every key in `grantable` |
| Cell disabled — requires | `permission.requires` set and the role (loaded value **with pending changes**) lacks that key → disabled, hint `ต้องติ๊ก "{label of the required key}" ก่อน` (today: ดูโมเดล 3D อาคาร needs ดูภาพรวมอาคาร). Unticking the required key in a row also unticks the dependent one in the same row (two pending changes) |
| Order of reasons (one shown) | row (`isLocked` / `guard`) → column (`grantable`) → requires |
| Save refused | `guardRule(err)` from `api.ts` (`403 PERMISSION_GUARD`): `OWN_ROLE` → toast `แก้สิทธิ์ของ role ตัวเองไม่ได้` · `SUPER_ADMIN` → `แก้สิทธิ์ของ Superadmin ไม่ได้` · `ESCALATION` → `ให้ได้เฉพาะสิทธิ์ที่คุณมี`; then refetch the matrix and drop pending changes that are now disabled (keep the rest); dialog closes. Nothing was saved |
| Role list tab | `getRoles()` → `RoleListItem[]` (`Role` + `guard` + `assignable`). `guard` set → no row menu; instead `Lock` + `Role ของคุณ` (`OWN_ROLE`) — `SUPER_ADMIN` rows already have no menu (`isLocked`) |
| Add Role "คัดลอกจาก" | offer every role, but a role whose matrix `permissions` are not all in `matrix.grantable` is a disabled option with the hint `มีสิทธิ์ที่คุณไม่มี`. Server `ESCALATION` → under the picker `คัดลอกได้เฉพาะ Role ที่มีสิทธิ์ไม่เกินของคุณ` |
| Edit / delete refused | `guardRule(err)` on `updateRole` / `deleteRole`: toast as "Save refused", refetch roles + matrix |
| S25 read-only | `can(me, PERM.settingsUsers)` false (only `settings.users.view`): role cell = plain text (no change button, no chevron), detail dialog button `เปลี่ยน Role` disabled with `LOCK_COPY.READ_ONLY` (the API returns `cannotChangeReason: "READ_ONLY"`) |
| S25 Superadmin rows | viewer is not Superadmin (`me.role !== "super_admin"`) and `u.role.key === "super_admin"` → plain text + `Lock`, title `LOCK_COPY.SUPER_ADMIN`; #9 returns `SUPER_ADMIN` → same copy under the disabled button |
| S25 change dialog | radio list = `roles.filter(r => r.assignable)` + the user's current role (marked `ปัจจุบัน`, even when not assignable). The Superadmin warning only appears when `super_admin` is offered (Superadmin viewers). `guardRule(err)` on `changeUserRole`: `SUPER_ADMIN` → `LOCK_COPY.SUPER_ADMIN` · `ESCALATION` → `เลือกได้เฉพาะ Role ที่มีสิทธิ์ไม่เกินของคุณ` (in the dialog's error line) + refetch roles. The role filter keeps every role |
| Forbidden copy | `roles-screen.tsx` still shows `การจัดการผู้ใช้ Role และสิทธิ์ สำหรับ Superadmin เท่านั้น` — use `settingsAccess(me, pathname)`'s copy instead (every key is tickable now) |
| Home services (`/`) | `usesService(me, "repair" \| "car" \| "room")` — only those cards (mobile grid and desktop row; columns = count). แจ้งซ่อม card: `canReport(me)` → `/repair/new`, hint `แจ้งปัญหาในอาคาร`; else → `repairHome(me)`, hint `ดูงานซ่อม`. No service at all → the บริการ section shows `EmptyState` `ยังไม่มีบริการที่ใช้ได้` hint `ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์` |
| Home CTA (`/`) | `canReport(me)` → as today (mobile card แจ้งซ่อม + สแกน QR; desktop hero แจ้งซ่อม + ติดตามงานซ่อม). Else, with any repair key: mobile card title `งานซ่อมของคุณ`, text `ดูงานที่ได้รับมอบหมายและงานที่คุณติดตาม`, one brand button `ไปที่งานซ่อม` (`Wrench`) → `repairHome(me)`, no สแกน QR; desktop hero: white button `ไปที่งานซ่อม` → `repairHome(me)` + glass `ติดตามงานซ่อม` → `/repair/my`. No repair key: card / hero without buttons (greeting only) |

**Mock mode:** role switcher users follow the seeded CR-006 matrix. **Admin** (ปวีณา) lacks ดำเนินการและบันทึกผลซ่อม · บันทึกงานทีมทำเอง · จัดการช่างภายนอก → those three columns are locked for her; her own row (Admin) and Superadmin are locked; in S25 she can only assign พนักงานทั่วไป and Admin (every other role has a key she lacks); ณัฐพล is Superadmin. **ช่างเทคนิค** has no report (Home: only แจ้งซ่อม → งานที่ต้องทำ, no CTA; `/repair/new` Forbidden; จองรถ / จองห้องประชุม gone from the navbar). Superadmin: nothing locked except the Superadmin row. Scenarios as before (`?mock=normal|error|forbidden|slow|conflict`). The mock `Me` is fixed per role, so a matrix change does not change the viewer's own menus until reload of the real API (wire checks AC2).

**Build:**

- [x] S24 matrix: new cards from data; disabled cells with the three reasons (desktop tooltip on the disabled checkbox's cell, mobile hint line under the switch label); requires-chain untick; settings card tickable
- [x] S24 save refused path (`PERMISSION_GUARD`), role list `guard`, Add Role copy-from limits, edit / delete refused
- [x] S25 read-only mode, Superadmin rows locked for non-Superadmin, change dialog shows only assignable roles, guard errors
- [x] Home `/`: services by permission, CTA variants (report / no report / no repair key), empty services state
- [x] Forbidden copy in S24 from `settingsAccess` (S25 too, shared `settings-forbidden.tsx`)
- [x] Accessible names unchanged (`{permission label} — {role name}`); disabled reasons reachable (`aria-describedby` on every disabled cell / switch)
- [ ] Check at 1280px and 375px in mock mode as Superadmin, Admin, ช่างเทคนิค, พนักงานทั่วไป — checked against the real API by e2e (desktop + mobile projects); a by-hand mock-mode pass is not done

**Acceptance (from `03-plan.md` Stage R1, UI part, mock mode):** AC1 UI (ช่างเทคนิค: Home and navbar show only แจ้งซ่อม, no report CTA), AC3 UI (as Admin in S24: Admin row and Superadmin row locked with the reason; ดำเนินการและบันทึกผลซ่อม column locked `ให้ได้เฉพาะสิทธิ์ที่คุณมี`; ticking ประวัติการเปลี่ยนแปลง for พนักงานทั่วไป saves), AC4 UI (as Admin in S25: own row has no change; ณัฐพล locked; change dialog for วรรณา lists พนักงานทั่วไป and Admin only), plus: ดูโมเดล 3D อาคาร disabled for พนักงานทั่วไป until ดูภาพรวมอาคาร is ticked. AC2, AC5 and the API 403s are Claude's in wire.

## Stage 4P — ประเภทอาคาร (CR-005, repair CR-025) (done, accepted 2026-10-29)

Changes to the built S20 / S22 / S26 only. Everything else stays as accepted.

**Spec:** the **CR-005 blocks** at the top of `screens/S20-buildings.md` and `screens/S22-categories.md` (copy is there, use it word for word). No new mockup: the new tab copies the `ประเภทอุปกรณ์` tab (table desktop / cards mobile, same heading action slot, same dialogs).

**Use these (Claude's, read-only for you):**

| Need | Use |
|---|---|
| Type list (S20 tab, S22 options, building dialog select) | `getBuildingTypes()` → `BuildingTypeAdmin[]` (active first). Columns: `name` · `buildingCount` (`{n}`) · `categoryIds.length` (`{n} หมวด`) · สถานะ from `isActive`. Selects / check boxes offer `isActive` types only |
| Add type | `createBuildingType({ name, categoryIds })` — dialog check boxes = `getCategories()` where `isActive && !isOther`, all ticked by default; toast `เพิ่มประเภทอาคาร "{ชื่อ}" แล้ว`, refetch types |
| Rename / (de)activate type | `updateBuildingType(id, { name? / isActive?, updatedAt })`. Before deactivating: `buildingCount > 0` → the blocked message straight away (no call); else the confirm dialog. The server may still answer `IN_USE` → same blocked message + refetch |
| Building dialog `แก้ไขอาคาร` | replaces the building rename dialog: `updateBuilding(id, { name, buildingTypeId, updatedAt })` (send both; `buildingTypeId` = the select value). Note `เปลี่ยนประเภทแล้วมีผลกับงานแจ้งใหม่เท่านั้น` under the select |
| Type tag | `PlanBuilding.buildingType.name` — small tag (`Badge` variant outline) next to the building name in the header / picker |
| S22 dialog | `ใช้กับประเภทอาคาร *` check boxes (active types, `getBuildingTypes()`); new category: none ticked; send `buildingTypeIds` on create (required) and on edit only when the set changed. Client check: none ticked → `เลือกประเภทอาคารอย่างน้อย 1 ประเภท`. `isOther` category: no check boxes, show `ใช้ได้กับทุกประเภทอาคาร`, never send `buildingTypeIds`. **Remove the area-type chips** (`AREA_LABELS`, `areas` state — Claude left a placeholder sending `buildingTypeIds: []` so the build stays green) |
| S22 header meta | `ใช้กับ: {type tags}` = names of `category.buildingTypeIds` (in `getBuildingTypes()` order); `isOther` → `ใช้กับ: ทุกประเภทอาคาร` |
| S26 | `building_type` entity label + `buildingType` / `buildingTypes` field labels are already added in `audit-screen.tsx` — check they render (change a building's type, then open S26) |
| Tab in the URL | `?tab=building-types` (after `?tab=asset-types`) |

**Error copy** (`ApiError`):

| Code | Where | Show |
|---|---|---|
| `VALIDATION_FAILED` `fields.name` `REQUIRED` / `TOO_LONG` | type / building dialog | กรุณากรอกชื่อ · ชื่อยาวได้ไม่เกิน 100 ตัวอักษร |
| `fields.buildingTypeIds` `MIN_ITEMS` | S22 dialog | เลือกประเภทอาคารอย่างน้อย 1 ประเภท |
| `fields.buildingTypeIds` `INVALID`, `fields.buildingTypeId` `INVALID`, `fields.categoryIds` `INVALID` | dialog | refetch types / categories, toast ทำรายการไม่สำเร็จ ลองอีกครั้ง (a type or category was just deactivated) |
| `NAME_TAKEN` | under the name | ชื่อนี้มีอยู่แล้ว |
| `IN_USE` (#55) | deactivate | ยังมีอาคารใช้ประเภทนี้อยู่ เปลี่ยนประเภทของอาคารก่อน |
| `VERSION_CONFLICT` | dialog | as the other S20 dialogs (refetch, `ข้อมูลนี้ถูกแก้โดย …`) |
| `BUILDING_TYPE_NOT_FOUND` / anything else | | refetch, toast ทำรายการไม่สำเร็จ ลองอีกครั้ง |

**Mock mode:** types = อาคารสำนักงาน (อาคาร 1, อาคาร 2) · โกดังเก็บของ (โกดังเก็บของ 1 (ตัวอย่าง)) · พื้นที่ภายนอกอาคาร (พื้นที่ภายนอกอาคาร); every type is used by a building, so deactivate → blocked — add a type first to try a working deactivate. Categories carry `buildingTypeIds` (ระบบปรับอากาศ = อาคารสำนักงาน only). Scenarios as before (`?mock=normal|empty|error|forbidden|slow`).

**Build:**

- [ ] S20 tab `ประเภทอาคาร`: table desktop / cards mobile, primary `เพิ่มประเภทอาคาร`, row menu `แก้ไขชื่อ` / `ปิดใช้งาน` / `เปิดใช้งาน`, inactive rows muted with badge, empty `ยังไม่มีประเภทอาคาร`
- [ ] Add-type dialog (name + `หมวดงานที่ใช้ได้` check boxes + hint) and rename dialog; deactivate confirm / blocked dialogs
- [ ] `แก้ไขอาคาร` dialog (name + type select + note) replacing the building rename dialog; type tag on the building header / picker
- [ ] S22 dialog field `ใช้กับประเภทอาคาร *` (+ `อื่น ๆ` read-only text), area chips removed; header meta `ใช้กับ:` tags
- [ ] States for the new tab: loading skeleton, error, empty, Forbidden (Admin + Superadmin have access)
- [ ] Check at 1280px and 375px in mock mode, as Superadmin and Admin

**Acceptance (from `03-plan.md` Stage 4P, UI part, mock mode):** AC1 (tab lists the 3 types with counts; add `โรงงาน` with all categories ticked → appears in the `แก้ไขอาคาร` select), AC2 (deactivate a used type → `ยังมีอาคารใช้ประเภทนี้อยู่ เปลี่ยนประเภทของอาคารก่อน`), AC4 (S22 new category with no type → `เลือกประเภทอาคารอย่างน้อย 1 ประเภท`; `อื่น ๆ` shows `ใช้ได้กับทุกประเภทอาคาร`), AC5 UI part (changes appear in S26). AC3 (repair form follows the type) is Claude's in wire.

## Stage 2 — S24 Role และสิทธิ์ (done, accepted 2026-10-27)

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
- Stage R1 only: `frontend/src/app/(app)/page.tsx` (Home services + CTA; the S29 dashboard it renders stays Claude's)
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
| S24 · S25 · Home `/` permission changes (Stage R1, Claude, D-133) | ✅ (real API) | e2e `F29-permission-guards`, `F29-s29-without-3d`, `F15-role-guards` + updated F15 / F25 / F28 / F29 / F30. Components: `roles/{permission-matrix,roles-screen,role-list,role-dialogs}.tsx`, `users/{users-screen,change-role-dialog}.tsx`, `settings-forbidden.tsx`, `app/(app)/page.tsx` |
| S24 Role และสิทธิ์ (Stage 2, Claude) | ✅ (mock + real API) | 1280px / 375px checked in mock mode (normal, conflict path, blocked delete, NAME_TAKEN); real API via `e2e/settings/F29-roles-matrix.spec.ts`. Components: `modules/settings/components/roles/{roles-screen,permission-matrix,role-list,role-dialogs}.tsx`, helpers `settings-ui.ts` |
| S25 ผู้ใช้ · S26 ประวัติการเปลี่ยนแปลง (Stage 3, Claude) | ✅ (mock + real API) | 1280 / 375 in mock mode; real API via `e2e/settings/F15-change-role.spec.ts`, `F30-audit.spec.ts`. Components: `modules/settings/components/users/*`, `audit/audit-screen.tsx` |
| S20 อาคารและอุปกรณ์ (Stage 4, Claude) | ✅ (mock + real API) | 1280 / 375 in mock mode (navigator, asset panel, asset dialog with inline type, types tab); real API via `e2e/settings/F26-places-assets.spec.ts`. Components: `modules/settings/components/places/*`; shared `components/shared/asset-icon.ts` |
| S22 หมวดงานและอาการ · S23 ประเภทผู้รับเหมา (Stage 5, Claude) | ✅ (mock + real API) | 1280 / 375 in mock mode; real API via `e2e/settings/F27-categories.spec.ts`, `F28-contractor-types.spec.ts`. Components: `modules/settings/components/{categories,contractor-types}/*`, `confirm-dialog.tsx`; shared `components/shared/category-icon.ts` (repair S03 / S06 / S07 tiles use it) |
| Administration shell (Stage 1, Claude) | ✅ (mock mode) | 1280px: Superadmin all items + guardian mascot; Admin บริการ + ข้อมูลกลาง (2 items), planner mascot, `/settings/users` Forbidden + "ไปที่อาคารและอุปกรณ์"; พนักงาน full-page Forbidden. 375px: drawer opens from "เปิดเมนูหลัก", Escape closes, focus back on the menu button. `/settings` → `/settings/buildings`. lint, typecheck, build pass. Components: `modules/settings/components/settings-{shell,heading,placeholder}.tsx` | | |

## Differences from mockup (Codex fills)

Stage R1 (Claude):

- D-134 (owner, 2026-11-01): the CR-006 navbar + "ตั้งค่าระบบ" dropdown / phone sheet are built in R1 on every page (sidebar / drawer removed; `components/shared/app-navbar.tsx`, `modules/settings/components/settings-menu.tsx`, `settings-shell.tsx` is now only the page frame); S24 matrix = one table per system with a two-level header; group renamed "งานทีม ช่างภายนอก และภาพรวมอาคาร". R2 keeps the page frame and restyle.

- S24 info strip: the approved "ทุก Role แจ้งซ่อมและติดตามงานตัวเองได้เสมอ / สิทธิ์ตั้งค่าระบบล็อกตามขอบเขตของผู้ดูแล" is no longer true under CR-006; replaced with R1 strings "Superadmin มีทุกสิทธิ์เสมอ" / "ให้ได้เฉพาะสิทธิ์ที่คุณมี · แก้สิทธิ์ของ role ตัวเองไม่ได้" (D-133, owner to confirm).
- Add Role picker hint: "คัดลอกเฉพาะสิทธิ์งานซ่อม…" (settings keys were never copied) → "คัดลอกได้เฉพาะ Role ที่มีสิทธิ์ไม่เกินของคุณ" — settings keys are copied since CR-006 (D-133).
- Locked cells: a whole locked row (Superadmin / own role) shows its reason once on the row header (`Lock` tooltip); its cells carry it only as `aria-describedby`. Column (`grantable`) and requires reasons get a tooltip per cell.
- Home without any repair key: mobile card shows the greeting as its title (no buttons); desktop hero has no buttons.
- Car / room service cards keep the "เร็ว ๆ นี้" chip (no link) as before — only their visibility follows `*.use`.

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

- Stage R1: none new from the build; copy written by Claude is listed in PROGRESS → Open issues (owner to confirm).
- Stage 2: none.
- Stage 1: none.
