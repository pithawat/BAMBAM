# S29 — หน้าแรก Admin / ผู้บริหาร (dashboard + อาคาร 3D) (CR-016)

Status: APPROVED (2026-10-19) — owner: "go" with `../mockups/S29-admin-dashboard-modern.html` as the layout and the owner's own 3D model (D-082)

> **CR-018 (2026-10-20):** รับเรื่อง is deep yellow (`--status-new` `#8C6600`, whole app). Emergency marker on top of the step colour: 3D pin red halo + red floor ring, label red border + ⚠, floor badge / phone list red chip `⚠ n` (#27 `criticalCount`), `ฉุกเฉิน` chip in the popover, legend `⚠ ฉุกเฉิน`. Ticket pins start 1.6 m behind the room label when the room allows.
>
> **CR-017 (2026-10-20):** ticket status on the model = the S11 steps in the step colours (`status-new` รับเรื่อง · `status-in-progress` กำลังดำเนินการ incl. ส่งกลับแก้ · `status-resolved` รอประเมินตรวจงาน; closed not shown). Building view: each floor is tinted with its first step that has tickets, and a badge beside it shows the floor + a count chip per step (live dot, hover lifts). Floor view: one 3D pin per open ticket (repair-map pin: stem, glowing head, ground ring) spread around its room's centre, label = last 3 digits of the ticket number → popover (step, title, number, room + spot, reported, `ดูรายละเอียดงาน` → S07); tickets from #6. Opening a floor plays the repair-map transition (floors above lift 16 m and fade, camera dives, crossfade to the plan; reverse on `‹ ภาพอาคาร`). Floors and footprint come from #27. Legend = the three steps + `1 หมุด = 1 งาน` + equipment. The band has 3 repair tiles; จองรถ / จองห้องประชุม show only `ยังไม่เปิดใช้งาน` (no numbers). Phone floor list: step chips per floor, step chip per ticket.
>
> **Approved sources (2026-10-19, D-082):**
> - **Layout and look:** `../mockups/S29-admin-dashboard-modern.html` (solid colours, wide 3D card, grouped status / attention, other services below). The older `S29-admin-dashboard.html` is superseded. **Do not use the 3D model inside either mockup.**
> - **3D model:** the owner's model in `แผนผังงานซ่อมอาคาร.html` (repo root) — **อาคาร 1 only** (building shell, ground floor, balcony floors, roof + billboard) and its **floor plan renderer** (floor 1 look: tiles, low walls cut at 1.2 m, columns, core, labels). Other buildings, site props, KPI / charts / table / drawers and its localStorage equipment are not used.
> - **Rooms of every floor** come from #30 (`rooms[].shape`, real outlines traced from the PDF for floors 1–6, migration `20261020000001`), not from the HTML's floor-1 `zones`.
> - Sub-lines of the แจ้งซ่อม rows use the #27 fields added in D-083 (see "Content" below).

- **Flows:** F23 (dashboard, 3D drill-down), F31 (place equipment), entry to F22 (S11) (see ../../02-flows.md)
- **Persona:** admin on desktop all day (edits equipment); executive on desktop, read-only; both sometimes on a phone (see ../../01-users.md)
- **Purpose of this screen (one sentence):** on opening the app, admin and executive see today's important numbers and, on the building itself, which floor / room / equipment has open repairs.
- **Route:** `/` (`app/(app)/page.tsx`) — admin / executive get S29; every other role keeps the S02 Home (Stage 6)
- **Mockup:** `../mockups/S29-admin-dashboard.html` (desktop view + edit mode + executive toggle + phone layout). Layout reference from the owner: `web ui style/admin dashboard1.png` (band of numbers, stat cards, panels) — with the 3D model in the centre instead of the charts. Look references: `dashboard building.png`, `floor plan.png` (repo root).
- **Data:** #27 overview, #30 floor plan, #29 asset types, #31–#34 assets → `modules/repair/api.ts`; car / room blocks = sample data in the frontend until those modules exist (BR-F23-3)

## Layout — desktop first (≥ 1280px; 1024–1279 = side columns narrower)

```
┌ navbar (CR-010): BAM · หน้าแรก* แจ้งซ่อม จองรถ จองห้องประชุม ·············· 🔔 ปวีณา ศรีสุข / Admin ┐
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ สวัสดีตอนเช้า คุณปวีณา · จันทร์ 19 ต.ค. 2569                          [อาคาร 1 ▾] [จัดวางอุปกรณ์] │
│ ┌ ภาพรวมวันนี้ ────────────────────────────────────────────────────────────────────────────┐ │
│ │ แจ้งซ่อมวันนี้ 3 │ งานค้างทั้งหมด 12 │ เลยกำหนดเสร็จ 2 │ รถออกวันนี้ 5 ตัวอย่าง │ ห้องประชุมใช้อยู่ 4/12 ตัวอย่าง │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ แจ้งซ่อม 300px ─┐ ┌ อาคาร 1 · 3D (flex 1, ~600px high) ───────────────┐ ┌ บริการอื่น 300px ┐ │
│ │ รับเรื่อง     4 ›│ │ [ชั้น 6..1 picker]           [+][−][⟲]           │ │ จองรถ  ตัวอย่าง  │ │
│ │ กำลังดำเนินการ 5 ›│ │        building model / floor plan                │ │ ออกวันนี้ 5 …    │ │
│ │ รอประเมินฯ    3 ›│ │        pins = open tickets per floor / room        │ │ จองห้องประชุม     │ │
│ │ ปิดแล้ว 7 วัน 18 ›│ │ legend · palette (edit mode)                       │ │ ใช้อยู่ 4/12 …   │ │
│ │ งานที่ควรติดตาม  │ └───────────────────────────────────────────────────┘ └─────────────────┘ │
│ │ (≤ 4 rows)      │                                                                         │
│ └────────────────┘                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Greeting row:** `สวัสดีตอนเช้า / ตอนบ่าย / ตอนเย็น คุณ{ชื่อ}` + long date. Right: building `Select` (only buildings with a model are 3D; others show the floor list), admin-only `จัดวางอุปกรณ์` (toggle; label `เสร็จสิ้น` while on).
- **ภาพรวมวันนี้** (one white panel, 5 tiles): แจ้งซ่อมวันนี้ · งานค้างทั้งหมด · เลยกำหนดเสร็จ (attention colour when > 0) · รถออกวันนี้ · ห้องประชุมใช้อยู่ — the last two carry a `ข้อมูลตัวอย่าง` chip. Repair tiles link to S11 (`?tab=assess`, all, overdue → S11 tab กำลังดำเนินการ). Only these 5 numbers; no charts.
- **แจ้งซ่อม column:** 4 stat rows (number + step label + `›` → S11 tab): รับเรื่อง · กำลังดำเนินการ · รอประเมินตรวจงาน · ปิดแล้ว 7 วัน; then **งานที่ควรติดตาม** (≤ 4 rows from #27 `attention`: ticket title, place, reason chip `เลยกำหนด` / `ส่งกลับ` / `ฉุกเฉิน`, → S07) + `ดูทั้งหมด` → S11.
- **3D card (centre):**
  - Building view: อาคาร 1, 6 floors stacked from data (floor height 3.5 m), white slabs + tinted glass; a pin on each floor with open tickets (`{n}`, colour = highest priority, information only CR-015). Hover a floor = highlight + tooltip `ชั้น {n} · งานค้าง {n}`; click = floor view. Drag = rotate, wheel / `+` `−` = zoom, `⟲` = reset.
  - Floor view: floor slab 32 × 15 m, rooms as tinted tiles with low walls, room name labels, pin per room with open tickets (click → list popover → S07), equipment as round icon chips (badge = open tickets). Floor picker (chips `6 … 1`, keyboard arrows) on the left; `‹ ภาพอาคาร` back. Floors without traced rooms show the outline + `ยังไม่มีผังห้องของชั้นนี้`.
  - Legend (bottom-left): pin colours ฉุกเฉิน · สูง · ปกติ / ต่ำ, equipment icons.
  - **Edit mode (admin):** palette bar at the bottom of the card with the 4 types (แอร์ · ไมค์ · ลำโพง · จอทีวี) + `เพิ่มอุปกรณ์` (form without dragging). Drag a type over the plan → the room under the pointer is highlighted, outside a room = red outline + `วางในห้องเท่านั้น`. Drop → asset dialog. Drag an existing chip → moves (toast `ย้าย {code} ไป{ห้อง}แล้ว` + `เลิกทำ`). Click a chip → popover with `แก้ไข` · `ปิดใช้งาน`. Building view in edit mode asks to pick a floor first.
- **บริการอื่น column:** จองรถ block (รถออกวันนี้ · รออนุมัติ · รถว่างตอนนี้) and จองห้องประชุม block (ใช้อยู่ตอนนี้ · จองวันนี้ · ห้องว่าง) with service icons, `ข้อมูลตัวอย่าง` chip and caption `ระบบจองรถ / ห้องประชุมยังไม่เปิดใช้งาน`. Replaced by real numbers when those modules exist.

**Executive:** same page; no `จัดวางอุปกรณ์`, no palette; chip popover shows info only.

**Phone / tablet (< 1024px):** no 3D. Greeting · ภาพรวมวันนี้ as a 2-column grid · แจ้งซ่อม counts · งานที่ควรติดตาม · **floor list** (`ชั้น {n}` · open count · priority dot · `›` → bottom sheet with that floor's rooms, equipment counts and open tickets) · บริการอื่น. Equipment editing is desktop only (caption `จัดวางอุปกรณ์ได้บนคอมพิวเตอร์`).

## Asset dialog (add / edit) — `Dialog`

| Field | Rule |
|---|---|
| ประเภท | read-only chip from the dragged type (add from the button: `Select`) |
| รหัสอุปกรณ์ * | prefilled from #34 (`AC-1-003`), editable; ≤ 50; letters, digits, `-`, `_` |
| ชื่ออุปกรณ์ * | ≤ 100, placeholder `เช่น แอร์ห้อง HR ตัวซ้าย` |
| ห้อง | prefilled from the drop point; `Select` of the floor's rooms (changing it clears the position → placed at the room centre) |

Buttons `ยกเลิก` · **`บันทึก`**. Deactivate = `AlertDialog` `ปิดใช้งาน {code}?` / `อุปกรณ์จะหายจากผัง งานซ่อมเดิมยังอ้างถึงได้ และรหัสนี้จะใช้กับอุปกรณ์ใหม่ไม่ได้` · `ยกเลิก` · **`ปิดใช้งาน`** (destructive).

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Band title | ภาพรวมวันนี้ |
| Band tiles | แจ้งซ่อมวันนี้ · งานค้างทั้งหมด · เลยกำหนดเสร็จ · รถออกวันนี้ · ห้องประชุมใช้อยู่ |
| Sample chip | ข้อมูลตัวอย่าง |
| Repair column | แจ้งซ่อม · รับเรื่อง · กำลังดำเนินการ · รอประเมินตรวจงาน · ปิดแล้ว 7 วัน · งานที่ควรติดตาม · ดูทั้งหมด |
| Row sub-lines (D-083, modern mockup) | รับเรื่อง: `รอช่างเริ่มดำเนินการ · เก่าสุด {n} วัน` (`oldestAwaitingAssessmentAt`; `วันนี้` when < 1 day; only the first part when null) · กำลังดำเนินการ: `เลยกำหนด {overdue} · ส่งกลับ {reworking}` · รอประเมินตรวจงาน: `ปิดอัตโนมัติเร็วสุด{วันนี้ / พรุ่งนี้ / วันที่ d MMM}` (`nextAutoCloseAt`; hidden when null) · ปิดแล้ว 7 วัน: `คะแนนเฉลี่ย {ratingAvgLast7Days}` (`ยังไม่มีคะแนน` when null) |
| Row / tile links (S11 tabs) | แจ้งซ่อมวันนี้ + รับเรื่อง → `/repair/admin/queue?tab=assess` · งานค้างทั้งหมด → `/repair/admin/queue` · เลยกำหนดเสร็จ + กำลังดำเนินการ → `?tab=repair` · รอประเมินตรวจงาน → `?tab=rating` · ปิดแล้ว 7 วัน → `?tab=closed` |
| Attention chips | เลยกำหนด · ส่งกลับ · ฉุกเฉิน |
| 3D card | อาคาร 1 · {n} ชั้น · ‹ ภาพอาคาร · ชั้น {n} · งานค้าง {n} · ยังไม่มีผังห้องของชั้นนี้ |
| Edit | จัดวางอุปกรณ์ · เสร็จสิ้น · ลากอุปกรณ์ไปวางในห้อง · เพิ่มอุปกรณ์ · วางในห้องเท่านั้น · เลือกชั้นก่อนจัดวางอุปกรณ์ |
| Dialog | เพิ่มอุปกรณ์ / แก้ไขอุปกรณ์ · ประเภท · รหัสอุปกรณ์ · ชื่ออุปกรณ์ · ห้อง · ยกเลิก · บันทึก |
| Errors | กรุณาใส่รหัสอุปกรณ์ · กรุณาใส่ชื่ออุปกรณ์ · รหัสนี้มีอุปกรณ์อื่นใช้แล้ว · ใช้ได้เฉพาะตัวอักษร ตัวเลข - และ _ |
| Toasts | เพิ่ม {code} แล้ว · ย้าย {code} ไป{ห้อง}แล้ว (เลิกทำ) · บันทึกแล้ว · ปิดใช้งาน {code} แล้ว |
| Other services | จองรถ · รถออกวันนี้ · รออนุมัติ · รถว่างตอนนี้ · จองห้องประชุม · ใช้อยู่ตอนนี้ · จองวันนี้ · ห้องว่าง · ระบบจองรถยังไม่เปิดใช้งาน · ระบบจองห้องประชุมยังไม่เปิดใช้งาน |
| Phone | จัดวางอุปกรณ์ได้บนคอมพิวเตอร์ |

## States

| State | What shows |
|---|---|
| Loading | Skeleton band tiles, stat rows, a grey block for the 3D card (the three.js chunk loads lazily) |
| Empty | No open tickets: numbers 0, no pins, attention list `ไม่มีงานที่ต้องติดตาม` with mascot `face` 64px |
| Error | #27 fails → inline Alert `โหลดภาพรวมไม่สำเร็จ` + retry; #30 fails → inside the 3D card + retry, the rest stays |
| No WebGL | 3D card shows the floor list (same as phone) |
| Forbidden | not applicable (other roles get S02) |
| Saving | dialog button spinner; a move shows the chip at the new place at once and rolls back with a toast if refused |

## Acceptance checklist

- [ ] Matches the mockup at 1440 and 390; no horizontal scroll at 390
- [ ] Numbers match S11 (same filters)
- [ ] Floor picker and floor list work with the keyboard; pins and chips have aria labels (`ชั้น 3 งานค้าง 2`, `แอร์ AC-1-001 แอร์ห้อง HR`)
- [ ] Edit mode: drag-add, drag-move with undo, edit, deactivate, add without dragging
- [ ] Executive sees no edit controls
- [ ] three.js loads only on this page (lazy) and renders on demand (no constant animation loop)
