# Common UI rules — ตั้งค่าระบบ (Admin / Superadmin)

Status: APPROVED (2026-10-16) — user approved screens + plan; visual style follows the new design direction (repair CR-008, pending) · CR-001–CR-004 applied 2026-10-26: administration shell, access split, visual design `../mockups/CR-001-admin-settings.html` (owner approved the design 2026-10-26)

<!-- Written by Claude in /ui-spec settings (2026-10-16). Every screen spec (S19–S26) refers to this file.
     Shell, labels, dates and shared state copy from ../../../repair/ui/screens/_common.md still apply unless this file says otherwise.
     Tokens and components: docs/shared/design-system.md -->

## 1. Who and where

- ~~Every screen is `super_admin` only (BR-ALL-1). Any other role: Forbidden state, reason "หน้านี้สำหรับ Superadmin เท่านั้น". Never render partial data.~~ (CR-001)
- (CR-001) Access per page = its `settings.*` permission (`../../04-api-contract.md`): S20, S22 → Admin + Superadmin; S23, S24, S25, S26 → Superadmin. Without it: the sidebar item is hidden and a direct URL shows the Forbidden state — title "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", body "การจัดการผู้ใช้ Role และสิทธิ์ สำหรับ Superadmin เท่านั้น" (S23–S26) or "บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ" (S20, S22), button "ไปที่อาคารและอุปกรณ์" when the viewer has that page. Never render partial data.
- Desktop first (D-008, admin persona); mobile works fully with the layouts each spec gives.
- ~~Header on desktop: H1 page title + one-line subtitle (Small, muted) under it, actions right-aligned on the same row (as in `attachments/matrix-permission-reference.png`).~~
- ~~Header on mobile: S19 uses the `bg-brand` short header "ตั้งค่าระบบ"; every other screen uses the white top bar (back · centered title · optional right action). No bottom nav on settings sub-pages; S19 keeps it.~~ (CR-001 / CR-002)
- (CR-002) **No top bar** on any settings page (no navbar, breadcrumbs, bell or account avatar). The page starts with the **page heading**: H1 title + one-line subtitle (muted), the page's primary action right-aligned on the same row, and a decorative role mascot beside the title (CR-003): `bam-mascot-admin-planner-white.webp` for Admin, `bam-mascot-superadmin-guardian-white.webp` for Superadmin (repair CR-029), 112px desktop / 72px mobile, `alt=""`. On < 1024px a menu button (`Menu`, 44px, aria-label "เปิดเมนูหลัก") sits left of the title and opens the drawer.
- (CR-002) One main working panel per page; navigators / context are visually subdued (lighter panel, smaller type). White bordered panels on a quiet gray canvas, blue primary actions (`web ui style/manage user.png`). No bottom nav on settings pages.

## 2. Navigation — administration shell (CR-001, CR-002, CR-004)

> **CR-006 (2026-10-29) — supersedes the sidebar / drawer below.** Layout reference: `../mockups/CR-006-design/App.tsx` + `index.css` (owner design); colours and fonts stay the design system's (`#2741FA`, Anuphan). (CR-006)
> - Settings pages keep the **app navbar** (D-064). Its "ตั้งค่าระบบ" button opens a dropdown: left column = groups (icon, name, one-line description, `>`), right column = the hovered group's sub-menus — **no `>` on sub-menus**, a check on the current page. Groups / items without permission are left out.
> - Groups (only real pages): **สถานที่และอุปกรณ์** — อาคารและอุปกรณ์ · ประเภทอาคาร · ประเภทอุปกรณ์ · **การให้บริการ** — หมวดงานและอาการ · ประเภทผู้รับเหมา · จองรถ / จองห้องประชุม ("เร็ว ๆ นี้") · **ผู้ใช้งานและสิทธิ์** — ผู้ใช้งาน · บทบาทและสิทธิ์ · ประวัติการเปลี่ยนแปลง.
> - Page frame: breadcrumb (หน้าแรก › ตั้งค่าระบบ › {group}) · page intro · a card with **only the open group's sub-menus** (the design's all-groups `category-tabs` row is dropped) · section heading (title, soft tag, description, primary action) · content.
> - Phones (< 1024px): the navbar menu sheet lists the groups, tapping one shows its sub-menus; the sub-menu row scrolls horizontally.
> - **D-134 (2026-11-01, built in R1):** the navbar is on every page, settings included, full-width and flush with the top and side edges (BAMBAM │ WORKPLACE · icon items · "ตั้งค่าระบบ" dropdown · separator · account); the sidebar / drawer below is removed. Phones: a settings icon in the brand row opens a sheet (groups → sub-menus, "กลุ่มทั้งหมด" back). Sub-menu labels: อาคารและอุปกรณ์ · ประเภทอาคาร · ประเภทอุปกรณ์ / หมวดงานและอาการ · ประเภทผู้รับเหมา · การจองรถ · การจองห้องประชุม (เร็ว ๆ นี้) / ผู้ใช้งาน · บทบาทและสิทธิ์ · ประวัติการเปลี่ยนแปลง. Page frame (breadcrumb, intro, sub-menu card) stays R2. (CR-006)
> - Services in the navbar / Home show by permission: แจ้งซ่อม = any `repair.*` key · จองรถ = `car_booking.use` · จองห้องประชุม = `room_booking.use`.

`app/(app)/settings/layout.tsx` replaces the app navbar on every `/settings/**` page. Visual reference: `../mockups/CR-001-admin-settings.html` (sidebar, drawer, headings).

**Entry points** (shared shell, Claude):

| Where | Entry | Route |
|---|---|---|
| App top navbar (D-064), users with any `settings.*` permission | "ตั้งค่าระบบ" (`Settings` icon) | `/settings` |
| S14 โปรไฟล์ (mobile and desktop), same users | row "ตั้งค่าระบบ" (`Settings`, `›`) above "ออกจากระบบ" | `/settings` |

`/settings` redirects to `/settings/buildings` for Admin and Superadmin (owner 2026-10-26). ~~S19~~ is removed.

**Sidebar** (desktop ≥ 1024px: fixed, ~232px, white/near-white, right border, no card frames around items):

| Part | Content |
|---|---|
| Identity (CR-004) | `frontend/public/brand/bam-logo.webp` 104px wide (`alt="BAMBAM"`) + label "ตั้งค่าระบบ" (muted) · no CPAC block |
| Group "บริการ" | หน้าแรก (`Home`, `/`) · แจ้งซ่อม (`Wrench`, the user's repair start route) · จองรถ (`Car`, static, badge "เร็ว ๆ นี้") · จองห้องประชุม (`DoorOpen`, static, badge "เร็ว ๆ นี้") |
| Group "ข้อมูลกลาง" | อาคารและอุปกรณ์ (`Building2`, `/settings/buildings`, `settings.locations.manage`) · หมวดงานและอาการ (`Tags`, `/settings/categories`, `settings.categories.manage`) · ประเภทผู้รับเหมา (`HardHat`, `/settings/contractor-types`, `settings.contractor_types.manage`; owner 2026-10-26) |
| Group "ผู้ใช้และสิทธิ์" (hidden when no item is allowed) | ผู้ใช้ (`Users`, `/settings/users`) · Role และสิทธิ์ (`ShieldCheck`, `/settings/roles`) · ประวัติการเปลี่ยนแปลง (`History`, `/settings/audit`; owner 2026-10-26) |
| Bottom (dev / UAT only) | the existing role switcher (D-005), collapsed — the prototype's "มุมมองตัวอย่าง" control is a review tool, not product UI |

Group labels: Small, uppercase-free, muted. Active item = section of the current route: `bg-secondary`/soft blue, primary text, `aria-current="page"`.

**Drawer** (< 1024px): the same sidebar slides in from the left over a dim overlay, with a close button (`X`, aria-label "ปิดเมนู") beside the logo. Focus moves into the drawer, Tab is trapped, Escape / overlay click / navigation closes it and focus returns to the menu button; the page behind is `inert`.

**Unsaved changes guard** (S24): navigating via the sidebar with pending matrix changes asks first (§5).

## 3. Labels (use exactly)

**Roles** (system keys keep the repair labels; custom roles show their stored name):
`employee` พนักงานทั่วไป · `housekeeper_lead` หัวหน้าแม่บ้าน · `security_lead` หัวหน้ารปภ. · `technician` ช่างเทคนิค · `admin` Admin · ~~`executive` ผู้บริหาร~~ (repair CR-024) · `super_admin` Superadmin

Role names are data after this module ships: the UI shows `role.name` from the API everywhere (profile, sidebar user card, role switcher, S25); the table above is only the seed.

**Badges:**

| When | Label | Style |
|---|---|---|
| item deactivated | ปิดใช้งาน | muted `Badge` (no dot), row text `text-muted-foreground` |
| system role (`employee`, `super_admin`) | role ระบบ | `bg-secondary text-secondary-foreground`, `Lock` 12px |
| user role fixed by env (BR-F25-2) | กำหนดโดยระบบ | `bg-secondary text-secondary-foreground`, `Lock` 12px |
| ~~floor has a floor plan~~ | ~~มีผังชั้น~~ | removed (CR-002) |
| fixed settings permission (S24, CR-001) | กำหนดโดยระบบ | muted, `Lock` 12px |
| contractor type created by a technician | สร้างโดยช่าง | muted |

**Audit actions (F30):** `create` เพิ่ม · `update` แก้ไข · `deactivate` ปิดใช้งาน · `activate` เปิดใช้งาน · `delete` ลบ · `role_change` เปลี่ยน role · `permissions_change` เปลี่ยนสิทธิ์ · `floor_plan_upload` อัปโหลดผังชั้น · `floor_plan_delete` ลบผังชั้น · `reorder` เรียงลำดับ

**Audit entity types:** `building` อาคาร · `floor` ชั้น · `room` ห้อง / โซน · `category` หมวดงาน · `symptom` อาการ · `contractor_type` ประเภทผู้รับเหมา · `role` Role · `user` ผู้ใช้ · `asset` อุปกรณ์ · `asset_type` ประเภทอุปกรณ์ (CR-001)

**Priority labels (S22, CR-001):** `critical` ฉุกเฉิน · `high` สูง · `medium` ปกติ · `low` ต่ำ — `PriorityIndicator` colors (repair).

## 4. Master list pattern (`MasterList`, module component — ~~S20, S21,~~ S22, S23)

> (CR-001) S20 and S22 follow the panel / navigator layouts of the CR-001 design (their specs). Row menus there open an action list (`DropdownMenu` desktop, bottom `Sheet` mobile) with the items each spec names. Drag reorder is not in the design: S22 keeps "เลื่อนขึ้น / เลื่อนลง" in the row menu (approved rule BR-ALL-5).

One white `Card` with a header row and item rows separated by `border` lines.

```
┌────────────────────────────────────────────────────────┐
│ อาคาร (2)                  [☐ แสดงที่ปิดใช้งาน] [+ เพิ่ม] │  ← card title H3 · toggle · small primary button
├────────────────────────────────────────────────────────┤
│ ⠿  อาคารหลัก                    7 ชั้น            ⋯  › │  ← drag handle · name H3 · meta Small muted · menu · chevron
│ ⠿  อาคารด้านหลัง  [ปิดใช้งาน]     2 ชั้น            ⋯  › │
└────────────────────────────────────────────────────────┘
```

- Row ≥ 56px (desktop) / 64px (mobile). Selected row (two-pane screens) = `bg-secondary` + 3px left bar `primary`.
- Drag handle `GripVertical` (desktop only, hidden while "แสดงที่ปิดใช้งาน" is on) + the row menu has "เลื่อนขึ้น" / "เลื่อนลง" for keyboard and mobile. Order saves right after the drop; toast "บันทึกลำดับแล้ว"; failure puts the row back + toast error.
- Row menu (`DropdownMenu`, trigger `MoreHorizontal` 44px, aria-label "ตัวเลือกของ {ชื่อ}"): แก้ไข · เลื่อนขึ้น · เลื่อนลง · ปิดใช้งาน / เปิดใช้งาน · ลบ (destructive). "ลบ" is disabled with the hint "เคยถูกใช้แล้ว ปิดใช้งานแทน" when `inUse` is true (BR-ALL-2).
- Inactive items are hidden unless "แสดงที่ปิดใช้งาน" is on; then they show with the "ปิดใช้งาน" badge at their position.
- Add / edit opens `Dialog` (desktop) / bottom `Sheet` (mobile) — one form, title "เพิ่ม{ชนิด}" / "แก้ไข{ชนิด}", buttons ยกเลิก · **บันทึก**. Enter submits.
- Empty: small empty card inside the list card — `Mascot face` 64px, title per screen, hint, small button "เพิ่ม{ชนิด}".

## 5. Dialogs used on several screens

All `AlertDialog`; bottom `Sheet` on mobile.

| Dialog | Title | Body | Buttons |
|---|---|---|---|
| Deactivate | ปิดใช้งาน "{ชื่อ}"? | {ชนิด}นี้จะไม่แสดงในตัวเลือกใหม่ งานเดิมยังแสดงชื่อนี้ เปิดใช้งานกลับได้ภายหลัง (+ per-screen extra line) | ยกเลิก · **ปิดใช้งาน** |
| Activate | — (no dialog; acts at once) | | toast เปิดใช้งาน "{ชื่อ}" แล้ว |
| Delete | ลบ "{ชื่อ}"? | ลบถาวร กู้คืนไม่ได้ | ยกเลิก · **ลบ** (destructive) |
| Leave with unsaved changes (S24) | ออกโดยไม่บันทึก? | มีการเปลี่ยนแปลง {n} รายการที่ยังไม่บันทึก | อยู่ต่อ · **ออกโดยไม่บันทึก** (destructive) |

Success toasts: เพิ่ม{ชนิด}แล้ว · บันทึกแล้ว · ปิดใช้งาน "{ชื่อ}" แล้ว · เปิดใช้งาน "{ชื่อ}" แล้ว · ลบ "{ชื่อ}" แล้ว · บันทึกลำดับแล้ว

## 6. Shared messages

| Case | Message | Where |
|---|---|---|
| Required name empty | กรุณากรอกชื่อ | under the field |
| Name too long | ชื่อยาวได้ไม่เกิน {n} ตัวอักษร | under the field |
| Duplicate name (`NAME_TAKEN`) | ชื่อนี้มีอยู่แล้ว | under the field |
| Someone else saved first (`VERSION_CONFLICT`) | inline `Alert` warning: ข้อมูลนี้ถูกแก้โดย {ชื่อ} เมื่อ {เวลา} · button "โหลดข้อมูลล่าสุด" | top of the dialog / page |
| Delete an item in use (`IN_USE`) | ลบไม่ได้ เพราะเคยถูกใช้แล้ว ปิดใช้งานแทน | toast error |
| Not super_admin (`FORBIDDEN`) | Forbidden state (§1) | page |
| Unknown / network | ทำรายการไม่สำเร็จ ลองอีกครั้ง | toast error (dialogs keep their input) |
| Whole page / part failed | repair `_common.md` §6 copy | |
| Duplicate asset code (`ASSET_CODE_TAKEN`, CR-001) | รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น | form error line |
| Whole page failed (CR-001 copy) | โหลดข้อมูลไม่สำเร็จ / ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง ข้อมูลที่ยังไม่บันทึกจะยังอยู่ · button ลองอีกครั้ง | page panel |

Forms in dialogs show server / validation errors in one `role="alert"` line at the top of the form (CR-001 design). Error codes are fixed in `../../04-api-contract.md`.

## 7. Sample data (mockups and `mocks.ts`)

Fictional names; buildings and categories match the dev sample seed (D-032).

- ~~**Buildings / floors:** อาคารหลัก ชั้น 1–7 · อาคารด้านหลัง ชั้น 1–2~~
- ~~**Rooms (อาคารหลัก ชั้น 5):** …~~ (CR-001)
- **Buildings / rooms / assets (CR-001):** as the CR-001 prototype data — อาคาร 1 (ชั้น 1: ห้องประชุม 1A, ห้องประชุม 1B, พื้นที่ส่วนกลางชั้น 1 · ชั้น 2: ฝ่ายบัญชี, ฝ่ายจัดซื้อ, พื้นที่ส่วนกลางชั้น 2 · ชั้น 3: ห้องประชุม 3A, พื้นที่ส่วนกลางชั้น 3) · อาคาร 2 (ชั้น 1: ห้องประชุม 1A, พื้นที่ส่วนกลางชั้น 1); assets AC-1-001, MIC-1-001, SPK-1-001, TV-1-001 (ห้องประชุม 1A), AC-1-002 (1B), AC-2-001 (ฝ่ายบัญชี); asset types = repair CR-016 seed (เครื่องปรับอากาศ AC, ไมโครโฟน MIC, ลำโพง SPK, จอทีวี TV)
- **Categories → symptoms:** as repair `_common.md` §8 (5 categories)
- **Contractor types:** ไฟฟ้า (3 ผู้รับเหมา) · ประปา (2) · เครื่องปรับอากาศ (2) · ลิฟต์ (1) · งานโครงสร้าง (0, สร้างโดยช่าง) · แอร์ (0, สร้างโดยช่าง, ปิดใช้งาน)
- **Roles (users):** พนักงานทั่วไป (412) · หัวหน้าแม่บ้าน (1) · หัวหน้ารปภ. (1) · ช่างเทคนิค (1) · Admin (2) · ~~ผู้บริหาร (3)~~ (repair CR-024) · Superadmin (1); custom role example "หัวหน้าช่าง" (0) for the add-role flow
- **People:** repair `_common.md` §8 + Superadmin **ณัฐพล อินทรวงศ์** (`EMP0105`, ฝ่ายเทคโนโลยีสารสนเทศ, env-defined)
- **Audit rows:** see the S26 spec

## Open questions (UI-level, none blocks the specs)

- Icon set offered for categories (S22): proposed the 12 lucide icons listed in S22 — add more on request.
- (CR-001) The prototype's review control "มุมมองตัวอย่าง" (role / state switcher) is not product UI; dev/UAT use the existing role switcher.
