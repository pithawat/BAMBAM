# Common UI rules — ตั้งค่าระบบ (Superadmin)

Status: DRAFT

<!-- Written by Claude in /ui-spec settings (2026-10-16). Every screen spec (S19–S26) refers to this file.
     Shell, labels, dates and shared state copy from ../../../repair/ui/screens/_common.md still apply unless this file says otherwise.
     Tokens and components: docs/shared/design-system.md -->

## 1. Who and where

- Every screen is `super_admin` only (BR-ALL-1). Any other role: Forbidden state, reason "หน้านี้สำหรับ Superadmin เท่านั้น". Never render partial data.
- Desktop first (D-008, admin persona); mobile works fully with the layouts each spec gives.
- Header on desktop: H1 page title + one-line subtitle (Small, muted) under it, actions right-aligned on the same row (as in `attachments/matrix-permission-reference.png`).
- Header on mobile: S19 uses the `bg-brand` short header "ตั้งค่าระบบ"; every other screen uses the white top bar (back · centered title · optional right action). No bottom nav on settings sub-pages; S19 keeps it.

## 2. Navigation entries (changes to the shared shell — listed in the repair permission CR)

| Where | Entry | Route |
|---|---|---|
| Desktop sidebar, new group "ตั้งค่าระบบ" (last group, `super_admin` only) | อาคารและชั้น (`Building2`) · หมวดงานและอาการ (`Tags`) · ประเภทผู้รับเหมา (`HardHat`) · Role และสิทธิ์ (`ShieldCheck`) · ผู้ใช้ (`Users`) · ประวัติการเปลี่ยนแปลง (`History`) | `/settings/...` |
| Mobile S14 โปรไฟล์ (`super_admin` only) | row "ตั้งค่าระบบ" (`Settings` icon, `›`) above "ออกจากระบบ" | `/settings` |
| Desktop S14 โปรไฟล์ | same row | `/settings` |

Active sidebar item = the section of the current route (`/settings/buildings/**` → อาคารและชั้น).

## 3. Labels (use exactly)

**Roles** (system keys keep the repair labels; custom roles show their stored name):
`employee` พนักงานทั่วไป · `housekeeper_lead` หัวหน้าแม่บ้าน · `security_lead` หัวหน้ารปภ. · `technician` ช่างเทคนิค · `admin` Admin · `executive` ผู้บริหาร · `super_admin` Superadmin

Role names are data after this module ships: the UI shows `role.name` from the API everywhere (profile, sidebar user card, role switcher, S25); the table above is only the seed.

**Badges:**

| When | Label | Style |
|---|---|---|
| item deactivated | ปิดใช้งาน | muted `Badge` (no dot), row text `text-muted-foreground` |
| system role (`employee`, `super_admin`) | role ระบบ | `bg-secondary text-secondary-foreground`, `Lock` 12px |
| user role fixed by env (BR-F25-2) | กำหนดโดยระบบ | `bg-secondary text-secondary-foreground`, `Lock` 12px |
| floor has a floor plan | มีผังชั้น | `bg-success/10 text-success`, `Image` 12px |
| contractor type created by a technician | สร้างโดยช่าง | muted |

**Audit actions (F30):** `create` เพิ่ม · `update` แก้ไข · `deactivate` ปิดใช้งาน · `activate` เปิดใช้งาน · `delete` ลบ · `role_change` เปลี่ยน role · `permissions_change` เปลี่ยนสิทธิ์ · `floor_plan_upload` อัปโหลดผังชั้น · `floor_plan_delete` ลบผังชั้น · `reorder` เรียงลำดับ

**Audit entity types:** `building` อาคาร · `floor` ชั้น · `room` ห้อง / โซน · `category` หมวดงาน · `symptom` อาการ · `contractor_type` ประเภทผู้รับเหมา · `role` Role · `user` ผู้ใช้

## 4. Master list pattern (`MasterList`, module component — S20, S21, S22, S23)

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

Error codes are fixed in `../../04-api-contract.md`.

## 7. Sample data (mockups and `mocks.ts`)

Fictional names; buildings and categories match the dev sample seed (D-032).

- **Buildings / floors:** อาคารหลัก ชั้น 1–7 · อาคารด้านหลัง ชั้น 1–2
- **Rooms (อาคารหลัก ชั้น 5):** ห้องประชุม 5A · ห้องประชุม 5B · ห้องประชุม 5C · ฝ่ายบัญชี · ฝ่ายจัดซื้อ · ห้องน้ำชาย · ห้องน้ำหญิง · พันทรี; ชั้น 5 has a floor plan (`ผังชั้น5.png`, 1.2 MB, uploaded by ปวีณา ศรีสุข)
- **Categories → symptoms:** as repair `_common.md` §8 (5 categories)
- **Contractor types:** ไฟฟ้า (3 ผู้รับเหมา) · ประปา (2) · เครื่องปรับอากาศ (2) · ลิฟต์ (1) · งานโครงสร้าง (0, สร้างโดยช่าง) · แอร์ (0, สร้างโดยช่าง, ปิดใช้งาน)
- **Roles (users):** พนักงานทั่วไป (412) · หัวหน้าแม่บ้าน (1) · หัวหน้ารปภ. (1) · ช่างเทคนิค (1) · Admin (2) · ผู้บริหาร (3) · Superadmin (1); custom role example "หัวหน้าช่าง" (0) for the add-role flow
- **People:** repair `_common.md` §8 + Superadmin **ณัฐพล อินทรวงศ์** (`EMP0105`, ฝ่ายเทคโนโลยีสารสนเทศ, env-defined)
- **Audit rows:** see the S26 spec

## Open questions (UI-level, none blocks the specs)

- Icon set offered for categories (S22): proposed the 12 lucide icons listed in S22 — add more on request.
