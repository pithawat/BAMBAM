# S24 — Role และสิทธิ์

Status: APPROVED (2026-10-16) — user approved screens + plan; visual style follows the new design direction (repair CR-008, pending)

- **Flows:** F29 (see ../../02-flows.md)
- **Persona:** Superadmin on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** decide what each role can do, and add, rename or remove roles.
- **Route:** `/settings/roles` (`?tab=permissions` default · `?tab=roles`)
- **Mockup:** `../mockups/S24-roles-permissions.html` (desktop matrix with changed cells + save bar, save dialog, Role tab, add-role dialog, mobile per-role switches)
- **Layout reference:** user sample `../../attachments/matrix-permission-reference.png` — one card per permission group, rows = roles, columns = actions, checkboxes
- **Data:** `getPermissionMatrix` (groups, permissions, roles with user counts, cells, `version`), `savePermissionMatrix`, `listRoles`, `createRole`, `updateRole`, `deleteRole`

## Permission groups (cards) and column labels

Keys and defaults: `../../01-users.md` → Permission catalog. The API returns groups and labels; this table is the seed copy.

| System | Card | Column label | Key | Tooltip (ⓘ next to the label) |
|---|---|---|---|---|
| ระบบแจ้งซ่อม | งานซ่อม | ดูทุกงาน | `repair.ticket.view_all` | เห็นงานซ่อมทุกงาน รวมชื่อและคะแนนช่างภายนอก |
| | | ประเมินและบันทึกผล | `repair.ticket.work` | งานซ่อมทุกงานส่งถึง role นี้ ประเมินวันคาดว่าเสร็จ และบันทึกผลซ่อม |
| | | ปรับความเร่งด่วน | `repair.ticket.set_priority` | เปลี่ยนความเร่งด่วนของงานใดก็ได้ |
| | | ปิดงานใดก็ได้ | `repair.ticket.close_any` | ปิดงานได้ทันทีโดยไม่ต้องรอตรวจรับ |
| | งานที่ทีมทำเอง | บันทึกงานทีมทำเอง | `repair.ticket.team_handle` | บันทึกงานที่ทีมแก้เองแล้วปิดทันที และส่งต่องานที่ตัวเองบันทึกให้ช่าง |
| | | ส่งต่องานทีมทุกงาน | `repair.ticket.handover_any` | ส่งต่องานทีมทำเองของใครก็ได้ให้ช่าง |
| | ช่างภายนอกและภาพรวม | จัดการช่างภายนอก | `repair.contractor.manage` | เพิ่มและแก้ไขข้อมูลช่างภายนอก |
| | | ดูภาพรวมอาคาร | `repair.overview.view` | เปิดภาพรวมอาคารและงานที่ยังไม่ปิดในแต่ละชั้น |

## Layout — mobile first

Mobile — tab "สิทธิ์":

```
┌──────────────────────────────┐
│ ‹     Role และสิทธิ์      [+] │ ← + = เพิ่ม role
│ [  สิทธิ์  |  Role 7  ]       │ ← segmented
│ ⓘ ทุก role แจ้งซ่อม ติดตามงาน… │
│ Role                          │
│ [ ช่างเทคนิค · 1 คน        ⌄ ] │ ← Picker
│ (🔧) ระบบแจ้งซ่อม              │
│ ┌ งานซ่อม ──────────────────┐ │
│ │ ดูทุกงาน              [●─] │ │ ← Switch, 64px rows
│ │ เห็นงานซ่อมทุกงาน รวม…      │ │
│ │ ประเมินและบันทึกผล     [●─] │ │
│ │ ปรับความเร่งด่วน  •    [─○] │ │ ← • = changed, not saved
│ │ ปิดงานใดก็ได้          [─○] │ │
│ └──────────────────────────┘ │
│ ┌ งานที่ทีมทำเอง ────────────┐ │
│ …                             │
│┌────────────────────────────┐│
││ เปลี่ยน 1 รายการ  [บันทึก]   ││ ← sticky save bar, only when dirty
│└────────────────────────────┘│
└──────────────────────────────┘
```

Mobile — tab "Role": `Card` list, row = name + badge · description (1 line) · "{n} คน" · ⋯ (แก้ไข · ดูผู้ใช้ · ลบ).

Desktop (≥1024px) — tab "สิทธิ์":

```
Role และสิทธิ์                                          [+ เพิ่ม role]
กำหนดว่าแต่ละ role ทำอะไรได้ในแต่ละระบบ
[ สิทธิ์ | Role 7 ]
ⓘ ทุก role แจ้งซ่อม ติดตามงานของตัวเอง และรับแจ้งเตือนได้เสมอ · Superadmin มีทุกสิทธิ์ แก้ไม่ได้
(🔧) ระบบแจ้งซ่อม
┌─────────────────────────────────────────────────────────────────────────────┐
│ งานซ่อม                 ดูทุกงาน ⓘ  ประเมินและบันทึกผล ⓘ  ปรับความเร่งด่วน ⓘ  ปิดงานใดก็ได้ ⓘ │ ← header row bg-muted
│ 🔒 Superadmin · 1 คน        ☑            ☑               ☑               ☑      │ ← disabled, bg-muted/40
│ พนักงานทั่วไป · 412 คน      ☐            ☐               ☐               ☐      │
│ หัวหน้าแม่บ้าน · 1 คน       ☐            ☐               ☐               ☐      │
│ หัวหน้ารปภ. · 1 คน         ☐            ☐               ☐               ☐      │
│ ช่างเทคนิค · 1 คน           ☑            ☑              [☑•]              ☐      │ ← changed cell: bg-secondary + dot
│ Admin · 2 คน               ☑            ☐               ☑               ☑      │
│ ผู้บริหาร · 3 คน            ☑            ☐               ☐               ☐      │
└─────────────────────────────────────────────────────────────────────────────┘
┌ งานที่ทีมทำเอง          บันทึกงานทีมทำเอง ⓘ   ส่งต่องานทีมทุกงาน ⓘ ┐ …
┌ ช่างภายนอกและภาพรวม     จัดการช่างภายนอก ⓘ    ดูภาพรวมอาคาร ⓘ    ┐ …
ระบบจองรถ · ระบบจองห้องประชุม — จะมีสิทธิ์ให้ตั้งเมื่อระบบเปิดใช้งาน   (muted line)
                       ┌──────────────────────────────────────────────┐
                       │ เปลี่ยน 1 รายการ   [ยกเลิกการเปลี่ยนแปลง] [บันทึก] │ ← sticky bottom of the main area, shadow-float
                       └──────────────────────────────────────────────┘
```

- Each card = `Card` with a `Table`: first column (role) fixed 260px, the permission columns share the rest equally, checkbox centered. Header row `bg-muted`, 52px; body rows 56px (sample density; still ≥ 44px targets — the whole cell is the click target).
- Row order: Superadmin first (locked), then the six seeded roles in glossary order, then custom roles by creation time.
- A newly created role (from the add dialog) is scrolled into view and its row flashes `bg-secondary` for 1.5s.

Desktop — tab "Role": `Card` + `Table`: Role (name + "role ระบบ" badge) · คำอธิบาย · ผู้ใช้ ("{n} คน", link → S25 `?role=`) · menu (แก้ไข · ลบ). Same row order.

## Components

| Area | Component | Notes |
|---|---|---|
| Tabs | segmented control (`SegmentedControl`) | "Role {n}" shows the count |
| Info line | `Alert` (default, `Info` icon), compact | |
| System heading | `ServiceIcon` 32px (repair) + H2 | |
| Matrix | `Card` + `Table` + `Checkbox` (add via shadcn) | checked = `bg-primary`; disabled checked = `bg-primary/40` + `Lock` on the row header |
| Column tooltip | `Tooltip` on an `Info` 16px button (aria-label "คำอธิบาย {label}") | |
| Mobile switches | `Switch` (add via shadcn) in list rows | label + description (Small muted) |
| Role picker (mobile) | `Picker` (`components/shared`) | options "{role} · {n} คน" |
| Save bar | sticky `Card` `shadow-float` | appears only when dirty |
| Save dialog | `AlertDialog` | summary list |
| Role dialogs | `Dialog` / `Sheet` | add / edit |
| Delete role | `AlertDialog` | two variants (has users / no users) |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / subtitle | Role และสิทธิ์ / กำหนดว่าแต่ละ role ทำอะไรได้ในแต่ละระบบ |
| Tabs | สิทธิ์ · Role {n} |
| Info line | ทุก role แจ้งซ่อม ติดตามงานของตัวเอง และรับแจ้งเตือนได้เสมอ · Superadmin มีทุกสิทธิ์ แก้ไม่ได้ |
| Row header | {role} · {n} คน |
| Locked row tooltip | Superadmin มีทุกสิทธิ์เสมอ |
| Future systems line | ระบบจองรถ · ระบบจองห้องประชุม — จะมีสิทธิ์ให้ตั้งเมื่อระบบเปิดใช้งาน |
| Save bar | เปลี่ยน {n} รายการ · ยกเลิกการเปลี่ยนแปลง · **บันทึก** |
| Save dialog | title: บันทึกการเปลี่ยนสิทธิ์? · per role: **{role}** ({n} คน) — เพิ่ม: {labels} · ถอด: {labels} · footer: มีผลกับผู้ใช้ทันทีในการใช้งานครั้งถัดไป ไม่ต้องออกจากระบบ · buttons ยกเลิก · **บันทึก** |
| Saved toast | บันทึกสิทธิ์แล้ว |
| Conflict (`VERSION_CONFLICT`) | inline `Alert` warning in the dialog: สิทธิ์ถูกแก้โดย {ชื่อ} เมื่อ {เวลา} · button "โหลดข้อมูลล่าสุด" → reloads, re-applies your changes on top, closes the dialog, toast "โหลดข้อมูลล่าสุดแล้ว ตรวจการเปลี่ยนแปลงอีกครั้งก่อนบันทึก" |
| Leave unsaved | `_common.md` §5 |
| Add role button | เพิ่ม role |
| Role dialog | title: เพิ่ม role / แก้ไข role · ชื่อ role * (≤ 50, placeholder: เช่น หัวหน้าช่าง) · คำอธิบาย (≤ 200, placeholder: role นี้ใช้กับใคร) · (add only) เริ่มต้นสิทธิ์: segmented "สิทธิ์พื้นฐานเท่านั้น" · "คัดลอกจาก role อื่น" → `Picker` "คัดลอกสิทธิ์จาก" * · buttons ยกเลิก · **เพิ่ม role** / **บันทึก** |
| Role toasts | เพิ่ม role "{ชื่อ}" แล้ว · บันทึกแล้ว · ลบ role "{ชื่อ}" แล้ว |
| Delete — has users (`ROLE_IN_USE`) | title: ลบ role นี้ไม่ได้ · body: มีผู้ใช้ {n} คนใน role "{ชื่อ}" ย้ายไป role อื่นก่อน · buttons ปิด · **ดูผู้ใช้** (→ S25 `?role=`) |
| Delete — no users | title: ลบ role "{ชื่อ}"? · body: ลบถาวร กู้คืนไม่ได้ · ยกเลิก · **ลบ role** (destructive) |
| System role menu | no "ลบ"; `super_admin`: no "แก้ไข" either (menu hidden); `employee`: "แก้ไข" only |
| Validation | กรุณากรอกชื่อ role · ชื่อนี้มีอยู่แล้ว · ชื่อยาวได้ไม่เกิน 50 ตัวอักษร · คำอธิบายยาวได้ไม่เกิน 200 ตัวอักษร · กรุณาเลือก role ที่จะคัดลอก |

## States

| State | What shows |
|---|---|
| Loading | tabs + info line; 3 cards with header row and 7 skeleton rows |
| Empty | n/a (system roles always exist) |
| Error | whole page shared copy; save failure: dialog stays open, toast error, changes kept |
| Forbidden | `_common.md` §1 |
| Saving | dialog primary button spinner + disabled |

## Interactions

- Click anywhere in a cell toggles it; Space toggles the focused checkbox; arrow keys move between cells inside a card (roving tabindex) — optional, Tab must work.
- Toggling back to the original value removes the "changed" mark and lowers the count.
- Switching tab with unsaved changes keeps them (same page); leaving the route asks (`_common.md` §5, also `beforeunload`).
- Mobile: changing the role in the Picker keeps pending changes of other roles; the save bar counts all of them.
- After save the matrix reloads from the response (new `version`).

## Acceptance checklist

- [ ] Matches the mockup at 375px and 1280px; desktop follows the user sample (cards per group, rows = roles, columns = actions)
- [ ] Superadmin row is checked and disabled; system roles cannot be deleted; `super_admin` cannot be edited
- [ ] Changed cells are marked, counted, revertible; save dialog lists exactly the changes per role with user counts
- [ ] Conflict path works (409 → reload and re-apply)
- [ ] Add role with "copy from" pre-fills that role's permissions; new row is highlighted
- [ ] Delete role with users shows the blocked dialog + link to S25 filtered by the role
- [ ] All states above with the exact copy; leaving with unsaved changes asks
- [ ] Keyboard: every checkbox / switch reachable, accessible name "{permission} — {role}"
- [ ] Works with mocks
