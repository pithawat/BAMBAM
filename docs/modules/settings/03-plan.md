# ตั้งค่าระบบ (Superadmin) — Build plan

Status: APPROVED (2026-10-16) — user approved screens + plan; visual style follows the new design direction (repair CR-008, pending) · repair CR-014 applied 2026-10-19 (Stage 4 / 5 notes) · CR-001–CR-004 applied 2026-10-26 (rework tasks tagged per stage; design `ui/mockups/CR-001-admin-settings.html`) · CR-005 applied 2026-10-27 (Stage 4P added)

<!-- Written by Claude in /stage-plan settings (2026-10-16). Stages are vertical slices that can be demoed.
     Each stage should fit in one focused session (Claude part + Codex part).
     Endpoints: 04-api-contract.md. Repair-side changes: ../repair/changes/CR-007.md (built inside these stages). -->

## Stages

| Stage | Goal (demoable) | Flows | Screens | Status |
|---|---|---|---|---|
| 1 | role เป็นข้อมูลในฐานข้อมูล ทุกระบบเช็คสิทธิ์แทนชื่อ role (ผลเหมือนเดิมทุก role); Admin และ Superadmin เห็นเมนู "ตั้งค่าระบบ" และเข้า administration shell (sidebar) ตามสิทธิ์ (CR-001) | F25, F29 (data only) | shell (CR-001), ~~S19~~ | done — accepted 2026-10-26 (e2e F25 + repair regression pass), tag `settings-stage-1` |
| 2 | Superadmin ติ๊กสิทธิ์ใน matrix แล้วผู้ใช้ role นั้นได้/เสียสิทธิ์ทันที; เพิ่ม แก้ ลบ role ได้; กลุ่ม "ตั้งค่าระบบ" แสดงแบบล็อก (CR-001) | F29 | S24 | done — accepted 2026-10-27 (Claude UI, D-115) |
| 3 | ค้นหาผู้ใช้และเปลี่ยน role ได้; ดูประวัติการเปลี่ยนแปลงทั้งหมด | F15, F30 | S25, S26 | done — accepted 2026-10-27 (Claude UI, D-115) |
| 4 | (CR-001 / CR-002) อาคารและอุปกรณ์: เลือกห้องจากผัง แก้ชื่ออาคาร/ห้อง จัดการอุปกรณ์ในห้อง และประเภทอุปกรณ์ (Admin + Superadmin) | F26 | S20 (redesigned), ~~S21~~ | done — accepted 2026-10-27 (Claude UI, D-115) |
| 5 | ตั้งค่าหมวดงาน อาการ (Admin + Superadmin, CR-001) และประเภทผู้รับเหมา (Superadmin) ได้ | F27, F28 | S22, S23 | done — accepted 2026-10-27 (Claude UI, D-115) |
| 6 | edge cases, สิทธิ์ทุก role, มือถือ, a11y และความพร้อม UAT | all | all | done — accepted 2026-10-27 (Claude, D-115) |
| 4P | **CR-005 (repair CR-025):** ประเภทอาคาร — แท็บ "ประเภทอาคาร" ใน S20, อาคารต้องมีประเภท, หมวดงานต้องระบุ "ใช้กับประเภทอาคาร" ใน S22 (Admin + Superadmin) — after repair 4P backend | F26, F27 | S20, S22 | pending |

(CR-001) Order unchanged. The administration shell (sidebar, drawer, page heading with mascot) is built in Stage 1 so every later stage only adds a page into it. Admin's own pages (4, 5) still follow the identity pages; Admin sees an empty-but-working shell until then.

Order rationale: everything depends on permission checks (1). The matrix is the user's main ask (2). Changing a person's role is the most frequent job (3) and the audit screen needs Stage 2–3 events. Buildings (4) move tables out of `repair`, so they come after the permission refactor is stable. Categories and contractor types (5) reuse the Stage 4 list pattern. 6 hardens.

## Decisions taken in this plan (DECISIONS.md D-048–D-051)

- D-048: buildings, floors, rooms and floor plans become shared data in `platform` (`ALTER TABLE … SET SCHEMA`, ids kept); categories, symptoms and contractor types stay in `repair`. The `settings` module has no schema: it orchestrates platform services and repair's `SettingsAdmin` service interface (wired in `cmd/api/main.go`).
- D-049: permissions are loaded per request from `platform.role_permissions` (one indexed query, no cache) so changes apply on the next request (BR-F29-7). Modules register their permission keys with Thai labels in Go; ~~`settings.manage` is a pseudo permission of `super_admin`.~~ Settings permissions are 7 fixed keys granted from the role key (CR-001, D-111).
- D-050: menu rules without extra permissions: "งานช่าง → งานซ่อม" and the technician bottom-nav slot need `repair.ticket.work`; "งานช่าง → ช่างภายนอก" needs `repair.contractor.manage`; the group "จัดการงานซ่อม" shows when the user has any of `set_priority`, `close_any`, `handover_any`, `overview.view` — its "งานทั้งหมด" and "ช่างภายนอก" items need `view_all`, "ภาพรวมอาคาร" needs `overview.view`. This reproduces today's menus for the six seeded roles.
- D-051: optimistic concurrency by `updatedAt` (items) / `version` (matrix, order) → `409 VERSION_CONFLICT`; floor plans are stored unresized next to photos (`PHOTO_STORAGE_DIR/floor-plans/`), served by `GET /api/v1/floor-plans/{floorId}` to any logged-in user.

---

## Stage 1 — role เป็นข้อมูล + เช็คสิทธิ์ + เมนูตั้งค่าระบบ

**Scope**
- Flows: F25; F29 data model only (no S24 yet)
- Screens: ~~S19~~ (removed, CR-001), administration shell `app/(app)/settings/layout.tsx` — sidebar / mobile drawer / page heading + role mascot (`ui/screens/_common.md` §1–§2, CR-001/CR-003/CR-004), entry in the top navbar and profile, forbidden state
- Endpoints: P1–P3 (changed); ~~#1~~ (CR-001)
- Repair CR-007 part A (permission checks, identical behaviour)
- Out of this stage: editing roles / matrix (2), users (3), master data (4–5)

**Backend (Claude)**
- [x] Migration `…_platform_roles.sql`: `platform.roles` (id, key unique, name, description, is_system, is_locked, sort_order, created_by_id, updated_by_id, timestamps; seed 7 roles with UUIDv5 ids), `platform.role_permissions` (role_id, permission, PK both; seed `01-users.md` defaults), `platform.permission_matrix` (single row: version, updated_by_id, updated_at), `platform.user_roles.role_id` (backfill from `role`, then drop `role` + CHECK), index `audit_log (created_at DESC)`; Down restores the text column
- [x] `internal/platform/permissions`: registry (module → groups → keys, label, description, `isFixed`), base permissions doc; repair registers its 7 keys (no `set_priority`, repair CR-015); ~~`settings.manage`~~ settings registers the 7 fixed `settings.*` keys granted from the role key (`admin` → locations / assets / categories; `super_admin` → all) (CR-001)
- [x] `internal/platform/roles`: repository + service (role of user, permissions of role, list with user counts)
- [x] Auth middleware loads `role` + `permissions` (stored + fixed) per request into the request context; `Viewer.Can(key)`; ~~`RequireSuperAdmin` middleware for `/api/v1/settings`~~ `RequirePermission(key)` per settings route (CR-001)
- [x] Config `SUPER_ADMIN_EMPLOYEE_CODES` (config.go, `.env.example`, architecture.md env table): upsert `super_admin` at API start and at login; `IsEnvSuperAdmin(code)`
- [x] `/me`: `role` (key), `roleName`, `permissions`; P2 one row per role; P3 any active role key, demo user created on demand (`ผู้ใช้ตัวอย่าง {roleName}`)
- [x] Repair (CR-007 A): `rules.go` / `service.go` use `Viewer.Can` (view_all, work, contractor.manage, team_handle, …); error codes unchanged
- [x] `internal/modules/settings`: routes, controller, service; ~~#1 summary~~ (CR-001); audit helper (`platform/audit.Write(ctx, tx, entry)`)
- [x] (CR-001) Repair asset writes #31–#34 check `settings.assets.manage` instead of role `admin`
- [x] Tests: table test "default matrix = old role behaviour" for every repair action × 6 roles; middleware 401/403; env bootstrap; `/me` permissions; Postgres integration for the migration backfill (CI)

**Frontend contract (Claude)**
- [x] `lib/platform/types.ts` (`Me.role: string`, `roleName`, `permissions`; `DemoUser.roleName`), `lib/platform/permissions.ts` (`can(me, key)`, key constants incl. the 7 `settings.*` keys, `canAnySettings(me)`), mocks per role incl. `super_admin`
- [x] Shared shell (Claude, shared code): ~~sidebar groups by permission (D-050) + "ตั้งค่าระบบ" group~~ top navbar (CR-010) menus by permission (D-050) + entry "ตั้งค่าระบบ" when `canAnySettings` (CR-001); bottom-nav technician slot by `repair.ticket.work`; role label from `roleName` (navbar, profile, role switcher); profile row "ตั้งค่าระบบ"
- [x] (CR-001) Home `app/(app)/page.tsx`: S29 dashboard for `repair.overview.view` (admin and now `super_admin`; no executive, repair CR-024) instead of the role names; S29 "จัดวางอุปกรณ์" toggle by `settings.assets.manage`
- [x] (CR-001) `/settings` page = redirect to `/settings/buildings` (both Admin and Superadmin, owner 2026-10-26); sidebar items hidden by permission; direct URL without the permission → Forbidden state
- [x] Repair FE (CR-007 A): `ticket-detail`, `contractors`, `technician-work`, `profile` use `can()`
- [x] `modules/settings/{types,mocks,api}.ts` ~~for #1~~ (navigation config + shared state components only, CR-001); `ui/HANDOFF.md` → `READY FOR CODEX — Stage 1`

**Frontend UI (Codex)**
- [x] ~~S19 `/settings` (+ `app/(app)/settings/layout.tsx` with the super_admin guard → forbidden state)~~ (CR-001)
- [x] (CR-001) Administration shell `app/(app)/settings/layout.tsx` — follow `ui/mockups/CR-001-admin-settings.html` (`_common.md` §1–§2): 232px sidebar with BAM logo (CR-004), groups บริการ / ข้อมูลกลาง / ผู้ใช้และสิทธิ์, no top navbar; drawer < 1024px with focus trap; page heading + role mascot (CR-003); placeholder pages for items of later stages

**Wiring + e2e (Claude)**
- [x] Real API; `e2e/settings/F25-settings-entry.spec.ts` (super_admin sees menu + every sidebar item; admin sees only ข้อมูลกลาง items and gets Forbidden on `/settings/users`, `/settings/roles`; employee → forbidden; API 403) (CR-001)
- [x] Existing repair e2e still green with the new `/me`

**Acceptance criteria**
- [ ] AC1: With `SUPER_ADMIN_EMPLOYEE_CODES` set to my code, after SSO login `/me` returns `role: super_admin` and the navbar shows "ตั้งค่าระบบ"; ~~S19 shows the counts~~ `/settings` opens อาคารและอุปกรณ์ in the administration shell with all sidebar items; Home shows the S29 dashboard (CR-001)
- [ ] AC1b (CR-001): Admin sees "ตั้งค่าระบบ"; the sidebar shows only อาคารและอุปกรณ์ · หมวดงานและอาการ; `/settings/users` and `/settings/roles` show Forbidden; the API returns 403 for #2–#12
- [ ] AC2: Every other role: no settings menu, `/settings` shows "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", ~~`GET /api/v1/settings/summary` → 403~~ `GET /api/v1/settings/roles` → 403 (CR-001)
- [ ] AC2b (CR-001): 1280px and 375px: sidebar ↔ drawer (Escape closes, focus returns), correct mascot per role, logo in sidebar and drawer, no top bar on settings pages
- [ ] AC3: Regression — repair Stage 1–2 demo script behaves exactly as before for พนักงาน, ช่างเทคนิค, Admin ~~, ผู้บริหาร~~ (repair CR-024) (menus, tabs, buttons, 403s)
- [ ] AC4: Deleting the row (`technician`, `repair.contractor.manage`) in the DB → on the next request the technician gets 403 on "เพิ่มช่างภายนอก" and, after reload, the button is gone; re-inserting restores it
- [ ] AC5: Role switcher lists 7 roles incl. Superadmin and switches correctly
- [ ] AC6: `go vet`, `go test ./...`, `tsc`, `eslint`, `next build` pass

**Demo script**
1. Set `SUPER_ADMIN_EMPLOYEE_CODES=<your code>`, restart the API, log in → navbar "ตั้งค่าระบบ" → administration shell (CR-001); role switcher → Admin → only ข้อมูลกลาง items
2. Role switcher → ช่างเทคนิค → งานซ่อม, ประเมินงาน work as before; → พนักงาน → `/settings` = forbidden
3. psql: delete the technician's `repair.contractor.manage` row → ช่างเทคนิค reloads S18 → no edit button

---

## Stage 2 — Role และสิทธิ์ (S24)

**Scope**
- Flows: F29 · Screens: S24 (both tabs, dialogs, mobile) · Endpoints: #2–#7
- (CR-001) Visual per `ui/mockups/CR-001-admin-settings.html#roles`: tabs ตารางสิทธิ์ / รายการ Role, matrix cards with the locked group "ตั้งค่าระบบ", sticky save bar, mobile per-role switches
- Out of this stage: user role changes (3)

**Backend (Claude)**
- [x] Roles CRUD (#2–#5): name unique (case-insensitive), copy-from, system / locked rules, delete only with 0 real users (demo users of that role deleted with it)
- [x] Matrix (#6, #7): catalog + roles + version; diff apply in one transaction with `SELECT … FOR UPDATE` on `permission_matrix`; unknown key / locked role / `FIXED_PERMISSION` errors (CR-001); fixed group in #6 with `isFixed`; copy-from skips fixed keys; audit `permissions_change` per role with Thai labels
- [x] Audit rows for role create / update / delete
- [x] Tests: service rules (system roles, in-use, version conflict, copy-from), controller error mapping

**Frontend contract (Claude)**
- [x] Types / mocks / api for #2–#7 (mock matrix = defaults); `components/ui/checkbox`, `switch`, `dropdown-menu` via shadcn; HANDOFF → Stage 2

**Frontend UI (Codex)**
- [x] S24 `/settings/roles` — follow ~~`ui/mockups/S24-roles-permissions.html`~~ `ui/mockups/CR-001-admin-settings.html#roles` (CR-001) — built by Claude (D-115)

**Wiring + e2e (Claude)**
- [x] `e2e/settings/F29-roles-matrix.spec.ts`: grant `repair.ticket.view_all` to พนักงานทั่วไป → the employee's `GET /api/v1/repair/tickets?scope=all` returns 200 on the next request; revoke → 403

**Acceptance criteria**
- [x] AC1: S24 shows three cards under ระบบแจ้งซ่อม with the default ticks from `01-users.md`; Superadmin row ticked and disabled
- [x] AC1b (CR-001): the card "ตั้งค่าระบบ" shows Admin ticked for อาคารและห้อง · อุปกรณ์ · หมวดงาน only, Superadmin all, other roles none; every cell disabled with "กำหนดโดยระบบ"
- [x] AC2: Untick ช่างเทคนิค → จัดการช่างภายนอก, save → dialog lists "ช่างเทคนิค (1 คน) — ถอด: จัดการช่างภายนอก" → after save the technician (role switcher) cannot add contractors without logging out
- [x] AC3: Add role "หัวหน้าช่าง" copied from ช่างเทคนิค → new row highlighted with the same ticks; it appears in the role switcher
- [x] AC4: Delete Admin → "ลบ role นี้ไม่ได้ · มีผู้ใช้ 2 คน…"; delete หัวหน้าช่าง (0 users) works
- [x] AC5: Two browser tabs: save in tab A, then save in tab B → B shows "สิทธิ์ถูกแก้โดย…" and keeps its changes after "โหลดข้อมูลล่าสุด"
- [x] AC6: Leaving with unsaved changes asks first; mobile shows per-role switches with the save bar

**Demo script**
1. Superadmin → Role และสิทธิ์ → untick ช่างเทคนิค / จัดการช่างภายนอก → บันทึก
2. Switch to ช่างเทคนิค → ช่างภายนอก has no "เพิ่มช่างภายนอก"
3. Back as Superadmin → เพิ่ม role "หัวหน้าช่าง" (คัดลอกจาก Admin) → tick ประเมินและบันทึกผล → บันทึก → switch to หัวหน้าช่าง → sees งานซ่อม and งานทั้งหมด

---

## Stage 3 — ผู้ใช้และประวัติการเปลี่ยนแปลง (S25, S26)

**Scope**
- Flows: F15, F30 · Screens: S25, S26 · Endpoints: #8–#12
- (CR-001) S25 visual per `ui/mockups/CR-001-admin-settings.html#users` (people panel, contextual role control, detail + role dialogs); S26 uses the same panel/table pattern and sits in the sidebar group ผู้ใช้และสิทธิ์

**Backend (Claude)**
- [x] Users search (#8: name TH/EN, code, email; Thai collation sort; demo users excluded), detail with role history (#9), role change (#10: self, env-locked, same-role no-op, audit `role_change`)
- [x] Audit list (#11: type / actor / date range / q filters, 50 per page) and actors (#12); `AuditEntry` mapping from `platform.audit_log.data`
- [x] Tests: role change rules, audit filters, PDPA (no full profile in `data`)

**Frontend contract (Claude)**
- [x] Types / mocks / api for #8–#12; HANDOFF → Stage 3

**Frontend UI (Codex)**
- [x] S25 `/settings/users` — ~~`ui/mockups/S25-users.html`~~ `ui/mockups/CR-001-admin-settings.html#users` (CR-001)
- [x] S26 `/settings/audit` — spec only (panel/table pattern of the CR-001 users page)

**Wiring + e2e (Claude)**
- [x] `e2e/settings/F15-change-role.spec.ts`, `F30-audit.spec.ts`

**Acceptance criteria**
- [x] AC1: Search "EMP0231" or "ธนากร" finds the technician; filter Role: Admin shows 2 people
- [x] AC2: Change วรรณา from พนักงานทั่วไป to หัวหน้าแม่บ้าน → toast; her next request has `repair.ticket.team_handle`; the sheet history shows the change with my name
- [x] AC3: My own row and env-defined Superadmins show "เปลี่ยน role" disabled with the reason; the API returns `CANNOT_CHANGE_SELF` / `ROLE_LOCKED`
- [x] AC4: Picking Superadmin shows the extra warning
- [x] AC5: S26 lists the Stage 2 matrix change and the AC2 role change with before → after; filters combine and live in the URL

---

## Stage 4 — อาคารและอุปกรณ์ (S20 redesigned) (CR-001 / CR-002)

**Scope**
- Flows: F26 (rewritten by CR-002) · Screens: S20 อาคารและอุปกรณ์ (tabs อุปกรณ์ในห้อง · ประเภทอุปกรณ์); ~~S21~~ removed · Endpoints: #13, #15, #27 (changed), #46–#52; repair CR-007 part B (buildings from platform)
- Structure (buildings, floors, rooms, floor plans) comes from the building plan; nothing here creates, deletes, reorders, deactivates or uploads (CR-002)
- Admin and Superadmin (`settings.locations.manage`, `settings.assets.manage`)

**Backend (Claude)**
- [x] Migration `…_platform_locations.sql`: `ALTER TABLE repair.buildings SET SCHEMA platform`, same for `floors` (ids and FKs kept, D-048); `updated_by_id` on buildings / rooms; `platform.floor_plans.floor_id` FK follows; `platform.asset_types.updated_by`; Down moves them back
- [x] `internal/platform/locations`: plan tree (#13), rename building / room with `updatedAt` check and case-insensitive uniqueness
- [x] `internal/platform/assets`: list per room incl. inactive (#46), create / patch / (re)activate (#47, #48), suggest code by room (#49), asset types list / create / patch with `codePrefix` + `mount` + `icon` validation (#50–#52) — repair #29–#34 (3D placement) keep their own queries on the same tables (D-116)
- [x] Settings endpoints #13, #15, #27, #46–#52 with `RequirePermission` and audit rows
- [x] Tests: rename keeps ids and assets, duplicate names, asset code uniqueness incl. inactive, move clears position, type prefix rules, 403 for non-admin roles, migration up/down (CI)

**Frontend contract (Claude)**
- [x] Types / mocks / api for #13, #15, #27, #46–#52; shared `components/shared/asset-icon.ts` (8 lucide icons) used by S20 and repair S29 (replaces S29's key map; shared code); HANDOFF → Stage 4

**Frontend UI (Codex)**
- [x] S20 `/settings/buildings` (`?tab=asset-types` for ประเภทอุปกรณ์) — follow `ui/mockups/CR-001-admin-settings.html#places` and `screens/S20-buildings.md`

**Wiring + e2e (Claude)**
- [x] `e2e/settings/F26-places-assets.spec.ts`: Admin renames a room → S03 shows the new name, same room id; adds a type "เครื่องพิมพ์" inline while adding an asset → the asset saves with that type; duplicate asset code refused; deactivate → gone from S29 and S03 asset picker

**Acceptance criteria**
- [x] AC1: As Admin: pick อาคาร 1 → ชั้น 1 → ห้องประชุม 1A shows its 4 assets; there is no control to add, delete or reorder buildings, floors or rooms, and floor names cannot be edited
- [x] AC2: Rename ห้องประชุม 1A → the repair form (S03) and S29 show the new name; its assets and tickets stay attached (same id)
- [x] AC3: Add asset `AC-1-003` → appears in the room list and S29 palette list; `ac-1-001` is refused "รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น"; move to another room keeps the code and clears the 3D position
- [x] AC4: Add type "เครื่องพิมพ์" (prefix `PRN`, ติดตั้งที่พื้น) inline in the asset dialog → selected at once and the other fields keep their values; duplicate name / prefix refused; new type shows its icon in S29
- [x] AC5: Deactivate / reactivate an asset; inactive hidden unless "แสดงอุปกรณ์ที่ปิดใช้งาน"
- [x] AC6: Existing repair tickets, S06/S07 locations, S29 3D and repair tests are unchanged after the schema move

<details><summary>Original Stage 4 (2026-10-16) — superseded by CR-002</summary>

### Stage 4 — อาคาร ชั้น ห้อง และผังชั้น (S20, S21) [superseded]

**Scope**
- Flows: F26 · Screens: S20, S21 · Endpoints: #13–#31, P8; repair CR-007 part B (buildings from platform, S12 contract note)
- (repair CR-014) `platform.rooms` (+ `area_type`) and the per-floor `พื้นที่ส่วนกลางชั้น {n}` rooms already exist from repair Stage 2M: this stage's migration only moves buildings / floors and adds `updated_by_id`; S21 rooms get a required **ประเภทพื้นที่** select; the common-area room cannot be deleted / deactivated; a new floor gets its common-area room automatically; room `inUse` counts tickets (`repair.tickets.room_id`)

**Backend (Claude)**
- [ ] Migration `…_platform_locations.sql`: `ALTER TABLE repair.buildings SET SCHEMA platform`, same for `floors` (FKs from `repair.tickets` keep working); add `updated_by_id`, `sort_order` where missing; `platform.rooms` (floor_id, name, sort_order, is_active, updated_by_id); floor plan columns on `platform.floors` (`plan_path`, `plan_file_name`, `plan_size`, `plan_updated_at`, `plan_updated_by_id`); unique (building_id, lower(name)) for floors, (floor_id, lower(name)) for rooms; Down moves them back
- [ ] `internal/platform/locations`: repository (own sqlc queries) + service: CRUD, order with version, bulk floors, level rewrite, floor plan store (`PHOTO_STORAGE_DIR/floor-plans/{floorId}/…`, JPEG / PNG ≤ 10 MB, no resize)
- [ ] Repair: sqlc queries join `platform.floors` / `platform.buildings`; #2 reads through `locations`; implements `FloorUsage` (`inUse`, `openTicketCount`) for the `SettingsAdmin` interface
- [ ] Settings endpoints #13–#31 (+ audit rows, `IN_USE` via repair usage), P8 file route in platform
- [ ] Tests: level rewrite / insert below, bulk names, order version, delete in-use, plan type / size, migration up/down (CI)

**Frontend contract (Claude)**
- [ ] Types / mocks / api for #13–#31; `MasterList` module component skeleton props documented in HANDOFF; HANDOFF → Stage 4

**Frontend UI (Codex)**
- [ ] S20 `/settings/buildings[/[buildingId]]`, S21 `/settings/buildings/[buildingId]/floors/[floorId]` — `ui/mockups/S20-buildings.html`

**Wiring + e2e (Claude)**
- [ ] `e2e/settings/F26-buildings.spec.ts`: add building + 3 floors (bulk) → appears in S03 อาคาร / ชั้น; deactivate a floor → gone from S03

**Acceptance criteria**
- [x] AC1: เพิ่มหลายชั้น 7 on a new building creates ชั้น 1–7, listed top first; dragging ชั้น 7 under ชั้น 6 persists after reload
- [x] AC2: The repair form (S03) shows the new building and floors immediately; a deactivated floor disappears from S03 but old tickets still show "อาคารหลัก ชั้น 3"
- [x] AC3: Delete is disabled for a floor that has tickets ("เคยถูกใช้แล้ว ปิดใช้งานแทน"); the deactivate dialog shows "มีงานที่ยังไม่ปิด {n} งาน" when there are open tickets
- [x] AC4: Upload a 1.2 MB PNG floor plan to ชั้น 5 → preview, meta line, lightbox; a 12 MB file or a PDF shows "รองรับ JPG, PNG ไม่เกิน 10 MB" and keeps the old plan
- [x] AC5: Rooms add / rename / reorder / deactivate / delete on S21
- [x] AC6: Existing repair tickets, S06/S07 locations and repair tests are unchanged after the schema move

</details>

---

## Stage 5 — หมวดงาน อาการ และประเภทผู้รับเหมา (S22, S23)

**Scope**
- Flows: F27, F28 · Screens: S22, S23 · Endpoints: #32–#45; repair CR-007 part C (#14 re-activates an inactive type + audit)
- (CR-001) S22 for Admin and Superadmin (`settings.categories.manage`), visual per `ui/mockups/CR-001-admin-settings.html#categories` (category navigator + symptom rows with priority badges, row menus, "แสดงที่ปิดใช้งาน"); S23 Superadmin only (`settings.contractor_types.manage`), panel pattern, sidebar item in ข้อมูลกลาง (owner 2026-10-26)
- (repair CR-014) S22: category default priority + every symptom priority **required** on create, editable for every category; category `ประเภทพื้นที่ที่มักเกิด` (multi, optional); the `isOther` category cannot be deleted / deactivated / un-flagged; initial data = the CR-014 master

**Backend (Claude)**
- [x] Repair `SettingsAdmin` implementation: categories / symptoms CRUD + order (+ `updated_by_id` columns migration), contractor types admin (count, created by, technician flag), usage (`inUse`)
- [x] Settings endpoints #32–#45 with audit rows; repair #14 change
- [x] Tests: last-active-symptom rule data (`activeSymptomCount`), in-use deletes, case-insensitive names

**Frontend contract (Claude)**
- [x] Types / mocks / api for #32–#45; shared category icon map `components/shared/category-icon.ts` used by S03 and S22 (shared code); HANDOFF → Stage 5

**Frontend UI (Codex → Claude, D-115)**
- [x] S22 `/settings/categories[/[categoryId]]` (~~S20 pattern~~ CR-001 design), S23 `/settings/contractor-types` (CR-001 panel pattern)

**Wiring + e2e (Claude)**
- [x] `e2e/settings/F27-categories.spec.ts`, `F28-contractor-types.spec.ts`

**Acceptance criteria**
- [x] AC1: New category "ลิฟต์และบันไดเลื่อน" (icon `door-open`) with 2 symptoms appears in S03 in the set order
- [x] AC2: Deactivating the last active symptom warns "หมวดนี้จะไม่แสดงในฟอร์มแจ้งซ่อม"; S03 hides the category
- [x] AC3: Contractor types show counts and "สร้างโดยช่าง"; deactivate "แอร์" → the technician's S17 picker no longer offers it; typing "แอร์" there re-activates it (audit row by the technician)
- [x] AC4: Delete is refused for used items with the shared message
- [x] AC5 (CR-001): Admin can do AC1–AC2 and AC4 for categories / symptoms; Admin has no ประเภทผู้รับเหมา item and gets Forbidden on `/settings/contractor-types`

---

## Stage 6 — edge cases, สิทธิ์ทุก role, มือถือ, UAT

**Scope**
- All flows / screens; e2e for every BR; mobile pass at 375px; a11y (keyboard matrix, labels); docs

**Tasks**
- [x] e2e: forbidden for each role without the route's permission on every settings route + API sample (Admin: users, roles, audit, contractor types) (CR-001); VERSION_CONFLICT for item, order, matrix; leave-unsaved guard; role deleted while S25 dialog open (`ROLE_NOT_FOUND`)
- [x] Mobile review of ~~S19–S26~~ S20, S22–S26 against the specs and the CR-001 design at 375px (drawer, bottom sheets); keyboard-only run through S24 and S20
- [x] `docs/shared/architecture.md` Roles section rewritten (roles as data, permissions, `super_admin`, env); `PROJECT.md` row; seed notes for UAT (first Superadmin code per environment)
- [x] Performance check: `/me` + permission load stays one query; audit list with 10k rows < 300 ms (index)

**Acceptance criteria**
- [x] AC1: Playwright suite for settings green in CI
- [x] AC2: Every screen shows loading / empty / error / forbidden states with the exact copy
- [x] AC3: UAT checklist written in `PROGRESS.md` (env codes, sample data, who tests what)

---

## Stage 4P — ประเภทอาคาร (CR-005, repair CR-025)

Status: pending — runs after repair Stage 4P and before repair 4R (D-121); needs the repair Stage 4P backend (the migration with `platform.building_types` and `repair.category_building_types` lives there). Built by Claude (D-115).

**Scope**
- Flows: F26 (BR-F26-6), F27 (BR-F27-1 CR-005 part) · Screens: S20 (tab `ประเภทอาคาร`, `แก้ไขอาคาร` dialog, type tag), S22 (`ใช้กับประเภทอาคาร *`) · Endpoints: #13, #15, #32–#34, #53–#55
- Shared code: `platform/queries/locations.sql`, `internal/platform` locations service

**Backend (Claude)**
- [ ] #13 `buildingType`; #15 `buildingTypeId` (active type, audit)
- [ ] #53–#55 building types (usage counts, `IN_USE` on deactivate, `NAME_TAKEN`, `VERSION_CONFLICT`, audit `building_type`)
- [ ] #32–#34 `buildingTypeIds` (required ≥ 1 on create, `NOT_ALLOWED` on `isOther`), drop `areaTypes`; audit diff shows the types
- [ ] Go tests: service rules + Pg integration (types, mapping, deactivate in use)

**Frontend (Claude)**
- [ ] `settings/{types,api,mocks}.ts`; S20 tab + dialogs + tag; S22 dialog field + header tags (remove the area-type multi-select); S26 audit labels for `building_type`
- [ ] e2e: add a building type, change อาคาร 1's type, category without types → error, `อื่น ๆ` locked

**Acceptance criteria**
- [ ] AC1: S20 `ประเภทอาคาร` lists อาคารสำนักงาน (1 อาคาร), โกดังเก็บของ (1), พื้นที่ภายนอกอาคาร (1); add `โรงงาน` with all categories ticked → it appears in the building dialog select
- [ ] AC2: Deactivating a type used by an active building shows `ยังมีอาคารใช้ประเภทนี้อยู่ เปลี่ยนประเภทของอาคารก่อน`
- [ ] AC3: Changing `โกดังเก็บของ 1 (ตัวอย่าง)` to อาคารสำนักงาน → the repair form shows ระบบปรับอากาศ for that building; changing back hides it
- [ ] AC4: S22 new category without a building type → `เลือกประเภทอาคารอย่างน้อย 1 ประเภท`; `อื่น ๆ` shows `ใช้ได้กับทุกประเภทอาคาร` (no check boxes)
- [ ] AC5: every change appears in S26; `go test ./...`, `tsc`, `eslint`, `next build`, settings e2e pass

---

## Open questions

- First Superadmin employee code(s) per environment — before UAT (Stage 6)
- Room booking will add usage for rooms and its own permission group — revisit `inUse` for rooms then
- (CR-002) The building-plan workflow (create / import floors and rooms, room area types, floor plans) has no owner module yet; until then structure changes are migrations, as for อาคาร 1 (repair CR-016)
- (CR-001) Asset type deactivate / reorder and category / symptom reorder UI are not in the design — keep the approved category / symptom rules; types stay add / edit only
