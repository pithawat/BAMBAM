# S25 — ผู้ใช้

Status: DRAFT

- **Flows:** F15 (see ../../02-flows.md); role history from F30
- **Persona:** Superadmin on desktop, sometimes mobile for a quick role change (see ../../01-users.md)
- **Purpose of this screen (one sentence):** find a person who has logged in and change their role.
- **Route:** `/settings/users` (`?q=&role=&page=&user={id}`)
- **Mockup:** `../mockups/S25-users.html` (desktop table + detail sheet + change-role dialog, mobile list + bottom sheet)
- **Data:** `listUsers` (search, role filter, page), `getUser` (incl. role history), `changeUserRole`, `listRoles` (filter + picker)

## Layout — mobile first

```
┌──────────────────────────────┐
│ ‹          ผู้ใช้              │
│ [🔍 ค้นหาชื่อ รหัส หรืออีเมล ] │
│ [Role: ทั้งหมด ⌄]              │ ← FilterPill
│ 421 คน                        │
│ ┌──────────────────────────┐ │
│ │ (ธพ) ธนากร พึ่งบุญ        › │ │ ← 40px initials avatar
│ │      EMP0231 · ฝ่ายอาคารฯ   │ │
│ │      [ช่างเทคนิค]           │ │
│ │ (ณอ) ณัฐพล อินทรวงศ์      › │ │
│ │      EMP0105 · ฝ่ายไอที      │ │
│ │      [Superadmin][กำหนดโดยระบบ]│
│ └──────────────────────────┘ │
│ [ ‹ ]  หน้า 1 / 22  [ › ]      │
└──────────────────────────────┘
```

Tap a row → bottom `Sheet` (90% height) with the detail (same content as desktop).

Desktop (≥1024px): H1 "ผู้ใช้" + subtitle. Toolbar card: search pill (360px) · `FilterPill` "Role" · result count right-aligned. `Card` + `Table`:

| ชื่อ (avatar + full name, email under it) | รหัสพนักงาน | แผนก / ตำแหน่ง | Role (badge) | เข้าใช้ล่าสุด | › |

Rows 60px; click → right `Sheet` 480px wide (`?user=` in the URL). Pagination under the table (`Pagination`, 20 per page). Sorted by name (Thai collation).

**Detail sheet:**

```
┌ ณัฐพล อินทรวงศ์ ───────────── ✕ ┐
│ (ณอ 56px)  ณัฐพล อินทรวงศ์          │
│            [Superadmin][กำหนดโดยระบบ]│
│ ข้อมูลจาก SSO (แก้ไม่ได้)            │
│ รหัสพนักงาน   EMP0105               │
│ อีเมล         nattapon.i@example.co.th │
│ แผนก          ฝ่ายเทคโนโลยีสารสนเทศ    │
│ ตำแหน่ง        เจ้าหน้าที่ระบบ          │
│ เข้าใช้ล่าสุด    16 ต.ค. 2569 08:41    │
│ ─────────────────────────────── │
│ Role                              │
│ Superadmin                [เปลี่ยน role] │ ← disabled + reason for self / env-defined
│ ประวัติ role                        │
│ • 15 ต.ค. 2569 14:02 พนักงานทั่วไป → ช่างเทคนิค โดยณัฐพล อินทรวงศ์ │
│ • 14 ต.ค. 2569 09:10 เข้าใช้ครั้งแรก (พนักงานทั่วไป) │
└───────────────────────────────────┘
```

**Change-role dialog** (`Dialog` / `Sheet`): `ChoiceField` of roles (≤ 5 → pills, 6–12 → grid, > 12 → `Picker`) with the current role marked "ปัจจุบัน"; selecting `super_admin` shows an inline `Alert` warning; confirm text updates live: "เปลี่ยน {ชื่อ} จาก {เดิม} เป็น {ใหม่}".

## Components

| Area | Component | Notes |
|---|---|---|
| Search | `Input` pill with `Search` icon | debounced 300 ms, min 2 chars, matches name TH/EN, employee code, email |
| Role filter | `FilterPill` | options: ทั้งหมด + roles with counts |
| Table / list | `Card` + `Table` / `Card` list (repair `_common.md` §4) | |
| Avatar | `Avatar` initials (first letters of first and last name, Thai) | `bg-secondary text-secondary-foreground` |
| Role badge | `Badge` `bg-secondary text-secondary-foreground` | Superadmin: `bg-foreground text-white` |
| Detail | `Sheet` (right on desktop, bottom on mobile) | |
| Change role | `Dialog` / `Sheet` + `ChoiceField` | |
| Pagination | `Pagination` | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title / subtitle | ผู้ใช้ / ทุกคนที่เคยเข้าใช้ BAMBAM ผ่าน SSO ปรับ role ได้ที่นี่ |
| Search placeholder | ค้นหาชื่อ รหัสพนักงาน หรืออีเมล |
| Filter | Role: ทั้งหมด / Role: {role} |
| Count | {n} คน |
| Table headers | ชื่อ · รหัสพนักงาน · แผนก / ตำแหน่ง · Role · เข้าใช้ล่าสุด |
| Last login | list date format (repair `_common.md` §3) |
| Sheet sections | ข้อมูลจาก SSO (แก้ไม่ได้) · Role · ประวัติ role |
| Sheet labels | รหัสพนักงาน · อีเมล · แผนก · ฝ่าย · ตำแหน่ง · เข้าใช้ล่าสุด (missing value: —) |
| Change button | เปลี่ยน role |
| Disabled reasons | เปลี่ยน role ของตัวเองไม่ได้ · role นี้กำหนดโดยระบบ (ตั้งค่าใน server) |
| History rows | {วันเวลา} {เดิม} → {ใหม่} โดย{ชื่อ} · first row: {วันเวลา} เข้าใช้ครั้งแรก ({role}) |
| Dialog | title: เปลี่ยน role · label: Role ใหม่ * · confirm line: เปลี่ยน {ชื่อ} จาก {เดิม} เป็น {ใหม่} · buttons ยกเลิก · **เปลี่ยน role** (disabled until a different role is picked) |
| Super admin warning | ผู้ใช้นี้จะตั้งค่าระบบและเปลี่ยนสิทธิ์ของทุกคนได้ |
| Success toast | เปลี่ยน role ของ {ชื่อ} เป็น {role} แล้ว |
| Errors | `CANNOT_CHANGE_SELF` เปลี่ยน role ของตัวเองไม่ได้ · `ROLE_LOCKED` role นี้กำหนดโดยระบบ (ตั้งค่าใน server) · `ROLE_NOT_FOUND` role นี้ถูกลบไปแล้ว เลือกใหม่ · others → toast (`_common.md` §6) |
| Empty search | ไม่พบผู้ใช้ที่ตรงกับ "{q}" / ผู้ใช้ต้องเข้าสู่ระบบ BAMBAM ด้วย SSO อย่างน้อย 1 ครั้งก่อน · button ล้างการค้นหา |
| Empty filter | ไม่มีผู้ใช้ใน role "{role}" · button ล้างตัวกรอง |
| User not found (`?user=` stale) | sheet shows: ไม่พบผู้ใช้นี้ · button ปิด |

## States

| State | What shows |
|---|---|
| Loading | toolbar + 8 skeleton rows; sheet: avatar + 6 skeleton lines |
| Empty | per copy (there is always at least the viewer, so the unfiltered list is never empty) |
| Error | whole page shared copy; sheet: inline `Alert` "โหลดข้อมูลผู้ใช้ไม่สำเร็จ" + ลองอีกครั้ง |
| Forbidden | `_common.md` §1 |
| Saving | dialog button spinner; row badge updates after success |

## Interactions

- Search / filter / page are in the URL (back button works); changing search or filter resets to page 1.
- After a role change the row, the sheet and the history update without a full reload.
- Demo users (role switcher) never appear (BR-F15-1).

## Acceptance checklist

- [ ] Matches the mockup at 375px and 1280px
- [ ] Search by name, code and email; role filter with counts; pagination keeps the filters
- [ ] Self and env-defined users cannot be changed (button disabled with the reason); API errors map to the copy above
- [ ] Super admin warning appears only when `super_admin` is picked
- [ ] Role history shows newest first, including the first login
- [ ] All states above with the exact copy
- [ ] Works with mocks
