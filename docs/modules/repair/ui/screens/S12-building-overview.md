# S12 — ภาพรวมอาคาร 3D

Status: APPROVED (2026-10-14)

> **CR-016 (approved 2026-10-19): S12 and S27 are replaced by S29** (admin / executive Home with the three.js model of อาคาร 1). D-025 (SVG, no 3D library) no longer applies.

> **CR-008 (approved 2026-10-16): replaced by S27 ภาพรวมองค์กร** — mockup `../../changes/CR-008/dashboard.html`; the S27 spec is written when Stage 7 is prepared.


- **Flows:** F23 (all steps), D-010 (mockup first; details later from the user) (see ../../02-flows.md)
- **Persona:** admin and executive on desktop (both read-only here — nothing to edit) (see ../../01-users.md)
- **Purpose of this screen (one sentence):** see at a glance which floor has open tickets and how urgent they are, then drill into that floor's tickets.
- **Route:** `/repair/admin/overview` (`?floor={floorId}&status=&category=`)
- **Mockup:** `../mockups/S12-building-overview.html` (3D view, floor selected, hover, empty floor, mobile list)
- **Data:** buildings with floors (count, order, name — drives the model), open-ticket counts per floor with the highest priority, tickets of one floor → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

The model is a **schematic**, not a real 3D scan: stacked floor slabs per building, generated from the building/floor list (D-010). Shape reference: `../../attachments/cpac-building.png` (main building about 7 floors + a low building behind). Floor count and names come from data, so fixing them later needs no UI change.

## Layout — desktop first (≥1024px)

```
┌ sidebar ┬─────────────────────────────────────────────────────────────────────┐
│         │ ภาพรวมอาคาร                       [UAT ดูในบทบาท: Admin ▾] [🔔]          │
│         │ (ยังไม่ปิดทั้งหมด 23)(รอช่างรับ 14)(กำลังดำเนินการ 6)(รอตรวจรับ 3) [หมวดงาน ▾] │ ← pill tabs = status filter
│         │ ┌ 3D card (flex 1) ───────────────────────────┐ ┌ panel 360px ────────────┐ │
│         │ │ ⓘ โมเดลอาคารเป็นภาพจำลองคร่าวๆ …                │ │ อาคารหลัก ชั้น 5          │ │
│         │ │                                              │ │ 4 งานยังไม่ปิด · ฉุกเฉิน 1  │ │
│         │ │            ┌───────┐ (7)                      │ │ ─────────────────────  │ │
│         │ │            ├───────┤ (6) ●2                   │ │ [● รอช่างรับงาน] ▮▮▮ฉุกเฉิน│ │
│         │ │            ├▓▓▓▓▓▓▓┤ (5) ●4  ← selected       │ │ น้ำรั่ว · ฝ้าเพดานรั่ว      │ │
│         │ │            ├───────┤ (4)                      │ │ ห้องประชุม 5A · 09:05    › │ │
│         │ │            ├───────┤ (3) ●1                   │ │ …                       │ │
│         │ │   ┌────┐   ├───────┤ (2) ●3                   │ │                         │ │
│         │ │   ├────┤(2)├───────┤ (1)                      │ │                         │ │
│         │ │   └────┘(1)└───────┘                          │ │                         │ │
│         │ │  อาคารด้านหลัง   อาคารหลัก                         │ │                         │ │
│         │ │ [⟲][⟳][รีเซ็ตมุมมอง]   ● ฉุกเฉิน ● สูง ● ปกติ/ต่ำ   [ดูแบบรายการ] │ │                         │ │
│         │ └──────────────────────────────────────────────┘ └─────────────────────────┘ │
└─────────┴─────────────────────────────────────────────────────────────────────┘
```

- **3D card:** isometric view of each building as stacked slabs (one slab per floor, floor 1 at the bottom). Each slab with open tickets gets a pin bubble on its right edge: count + color of the highest priority on that floor (ฉุกเฉิน `destructive`, สูง `priority-high`, ปกติ / ต่ำ `primary`). Floors with none: no pin, slab in `muted`.
  - hover a slab → slab tinted `accent`, `Tooltip` "{อาคาร} ชั้น {n} · {count} งานยังไม่ปิด · ฉุกเฉิน {m}" (omit the last part when 0)
  - click a slab or its pin → selected: slab `bg-primary/15` + 2px `ring`, panel shows that floor; `?floor=` updates
  - controls: rotate left / right (90° steps), reset view; legend; toggle "ดูแบบรายการ"
  - info line (Caption, muted, top-left): "โมเดลอาคารเป็นภาพจำลองคร่าวๆ — จำนวนชั้นและชื่อชั้นมาจากข้อมูลอาคาร"
- **Panel (right):**
  - nothing selected → "สรุปทุกชั้น": rows per floor with open tickets, sorted by highest priority then count: "{อาคาร} ชั้น {n}" · count · priority dot; click → select that floor
  - floor selected → header "{อาคาร} ชั้น {n}" + "{count} งานยังไม่ปิด · ฉุกเฉิน {m}" + ✕ (clear); list rows: status badge + `PriorityIndicator` · title · `จุดที่เกิด · {time}` · `›` → S07; ordered by priority then report time
- **Filters:** pill tabs filter which tickets count (all open / `new` / `in_progress` / `resolved`); หมวดงาน `Select` (ทุกหมวด). Pins and panel follow the filters.
- **List view** ("ดูแบบรายการ"): replaces the 3D card with a `Table`: อาคาร · ชั้น · งานยังไม่ปิด · ฉุกเฉิน · สูง · ปกติ/ต่ำ — click a row = select floor. This is also the accessible equivalent of the 3D view.

Mobile (<1024px): white top bar "ภาพรวมอาคาร"; info card with mascot `face` "ภาพ 3D ดูได้ดีที่สุดบนจอคอมพิวเตอร์" ; the same status pills; the floor list (list card rows: "{อาคาร} ชั้น {n}" · count · priority dot · `›`) → tapping opens a bottom `Sheet` with that floor's tickets.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| 3D view | module component `BuildingModel` — CSS 3D transforms (`perspective`, `rotateX/Z`) on stacked divs, data-driven | rendering approach confirmed in `/stage-plan` (CSS 3D is enough; three.js only if the user wants free rotation) |
| Pins | small round `Badge` with count, priority color + `ring-2 ring-card` | also focusable buttons |
| Tooltip | `Tooltip` | |
| Controls | `Button` outline icon ×2 (`RotateCcw`, `RotateCw`) + `Button` outline sm "รีเซ็ตมุมมอง" + toggle `Button` "ดูแบบรายการ" | |
| Legend | dots + text | color never alone: legend + numbers + tooltip text |
| Filters | pill `Tabs` + `Select` | |
| Panel | `Card` + list rows (`_common.md` §4) | |
| List view | `Table` in `Card` | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | ภาพรวมอาคาร |
| Status pills | ยังไม่ปิดทั้งหมด {n} · รอช่างรับ {n} · กำลังดำเนินการ {n} · รอตรวจรับ {n} |
| Category filter | ทุกหมวด |
| Info line | โมเดลอาคารเป็นภาพจำลองคร่าวๆ — จำนวนชั้นและชื่อชั้นมาจากข้อมูลอาคาร |
| Building labels | {ชื่ออาคาร} (from data; sample: อาคารหลัก, อาคารด้านหลัง) |
| Floor label on slab | {n} (or the floor name from data) |
| Tooltip | {อาคาร} ชั้น {n} · {count} งานยังไม่ปิด · ฉุกเฉิน {m} |
| Pin aria-label | {อาคาร} ชั้น {n}: {count} งานยังไม่ปิด |
| Controls | หมุนซ้าย (aria) · หมุนขวา (aria) · รีเซ็ตมุมมอง · ดูแบบรายการ / ดูแบบ 3D |
| Legend | ฉุกเฉิน · สูง · ปกติ / ต่ำ |
| Panel default title | สรุปทุกชั้น |
| Panel floor header | {อาคาร} ชั้น {n} · {count} งานยังไม่ปิด · ฉุกเฉิน {m} |
| Panel clear aria-label | ล้างการเลือกชั้น |
| List view columns | อาคาร · ชั้น · งานยังไม่ปิด · ฉุกเฉิน · สูง · ปกติ / ต่ำ |
| Mobile info | ภาพ 3D ดูได้ดีที่สุดบนจอคอมพิวเตอร์ |
| Empty — whole building | ไม่มีงานที่ยังไม่ปิด / ทุกชั้นเรียบร้อยดี |
| Empty — floor | ไม่มีงานค้างในชั้นนี้ |
| Empty — no building data | ยังไม่มีข้อมูลอาคารและชั้น / ติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูลอาคาร |
| Error | whole page: `_common.md` §6 · panel only: Alert โหลดรายการงานไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button ลองอีกครั้ง |
| Forbidden reason | หน้านี้สำหรับ Admin และผู้บริหาร |

## States

| State | What shows |
|---|---|
| Loading | Skeleton: 3D card as a large rounded block with a pulsing building silhouette; panel with 5 skeleton rows. |
| Empty | No open tickets → model without pins + panel empty card (mascot `full` 120px, copy above). Selected floor with none → small empty text in the panel. No building data → empty card in place of the model. |
| Error | Model/counts fail → whole-page error. Floor list fails → panel Alert. |
| Forbidden | Roles other than admin / executive (`_common.md` §6). |
| Success feedback | — (read-only). |

## Interactions

- Click / Enter / Space on a slab or pin → select floor. Esc or ✕ → clear.
- Tab order: filters → pins (top floor first, per building) → controls → panel.
- Rotate buttons turn the model 90°; reset returns to the default angle. Respect `prefers-reduced-motion` (no animated rotation).
- Filters change pins and the panel at once (`?status=`, `?category=` in the URL).
- Ticket row → S07.
- Data refreshes on page focus.
- Validation: none.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches `S12-building-overview.html` at 1280px (3D, selected floor, list view) and 375px (floor list + sheet)
- [ ] Model is generated from the building/floor data (changing the mock floor count changes the model)
- [ ] Pin colors follow the highest priority; numbers always visible; legend present
- [ ] Hover tooltip, selection, clear, rotate, reset, list view all work by mouse and keyboard
- [ ] Empty / error / forbidden states with the exact copy
- [ ] Uses only design-system tokens and shadcn components (3D transforms are the only non-token styling, documented in the component)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`) for admin and executive
