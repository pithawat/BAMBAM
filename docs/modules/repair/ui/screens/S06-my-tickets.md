# S06 — งานของฉัน

Status: APPROVED (2026-10-14)

- **Flows:** F06 (list, search, filters, open detail), BR-F06-1, BR-F06-2 (see ../../02-flows.md)
- **Persona:** every role, mobile first (employee checking progress); desktop usable (see ../../01-users.md)
- **Purpose of this screen (one sentence):** list the tickets I reported or follow, with the ones waiting for my confirmation on top.
- **Route:** `/repair/my` (`?tab=open|resolved|closed&q=&range=&scope=`)
- **Mockup:** none. Closest: `docs/shared/style/options/option-a.html` (awaiting card, list card, desktop table with pill tabs) + `../mockups/S09-technician-queue.html` (ServiceHeader, filter row)
- **Data:** my tickets (reported + subscribed), paged, filtered by tab / search / date range / scope; tab counts → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

Admin and executive see the same page with their own tickets. All tickets live in S11.

## Layout — mobile first

```
┌────────────────────────────┐
│ ServiceHeader (repair, orange, curved) │
│ (🔧) งานของฉัน                │
│      งานที่คุณแจ้งและติดตาม     │
│┌──────────────────────────┐│ ← search card overlaps header (shadow-float)
││ 🔍 ค้นหาเลขงาน หรือสถานที่ [⚙]││ ← Input pill + filter icon button (dot when a filter is active)
│└──────────────────────────┘│
│ (กำลังดำเนินการ 2)(รอตรวจรับ 1)(ปิดแล้ว) │ ← pill tabs with counts, horizontal scroll if needed
│┌ รอคุณตรวจรับ  ปิดอัตโนมัติ 17 ต.ค. หากไม่ตรวจรับ ┐│ ← only in tab รอตรวจรับ, tickets I reported
││ แอร์ไม่เย็น · มีน้ำหยด               ││   (same card as Home, option-a "a-await")
││ 📍 อาคารหลัก ชั้น 5 · ห้องประชุม 5B   ││
││ 🕘 RP-2569-000142 · ช่างบันทึกผล 10:15 ││
││ [ส่งกลับให้แก้] [✓ ตรวจรับงาน]       ││
│└──────────────────────────┘│
│┌ list card ────────────────┐│ ← `_common.md` §4 rows
││ (◷) ก๊อกน้ำ… น้ำรั่ว            › ││
││     อาคารหลัก ชั้น 2 · ห้องน้ำชาย   ││
││     [● ซ่อมเสร็จ รอตรวจรับ] คุณติดตามเคสนี้ · 13 ต.ค. ││
│└──────────────────────────┘│
│ [ โหลดเพิ่ม ]                 │ ← Button outline, only when more pages
├────────────────────────────┤
│ BottomNav (งานของฉัน active)  │
└────────────────────────────┘
```

Filter sheet (bottom `Sheet`): ช่วงวันที่แจ้ง (radio pills: ทั้งหมด · 7 วันล่าสุด · 30 วันล่าสุด · 90 วันล่าสุด) and งานที่แสดง (ทั้งหมด · ที่ฉันแจ้ง · ที่ฉันติดตาม); footer "ล้างตัวกรอง" (link) + "ใช้ตัวกรอง" (default).

Tabs:

| Tab | `?tab` | Shows | Order |
|---|---|---|---|
| กำลังดำเนินการ | `open` | `new`, `in_progress` | latest update first |
| รอตรวจรับ | `resolved` | `resolved` | tickets awaiting **my** confirmation first (tinted cards), then followed ones; each group latest first |
| ปิดแล้ว | `closed` | `closed` (any reason) | closed time, newest first |

Default tab: `resolved` when at least one ticket awaits my confirmation, otherwise `open`.

Desktop (≥1024px): sidebar + top bar (title "งานของฉัน", search pill in the top bar). One `Card`:
- header row: pill tabs with counts (left) · date-range `Select` + scope `Select` (right)
- awaiting tickets (tab รอตรวจรับ) as a tinted strip of cards above the table (max 3 across)
- `Table`: เลขงาน · เรื่อง / สถานที่ (meta under: location · people) · หมวดงาน · ความเร่งด่วน · สถานะ (badge + closed-reason caption) · อัปเดตล่าสุด · action ("ตรวจรับงาน" default sm for my resolved tickets, otherwise "ดู ›" ghost sm)
- footer: `Pagination` (20 per page) + "แสดง {a}–{b} จาก {n} งาน"

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Header | `ServiceHeader` repair | mobile |
| Search | `Input` pill with `Search` icon, debounce 300 ms | searches `ticket_no` and location text |
| Filter | `Button` outline icon + `Sheet` (mobile) / `Select` ×2 (desktop) | |
| Tabs | pill `Tabs` with counts | active = `bg-foreground text-white` |
| Awaiting card | tinted card + solid badge | design-system "รอคุณตรวจรับ" |
| List | list card rows (`_common.md` §4) / `Table` in `Card` | |
| Status, priority | `Badge`, `PriorityIndicator` | labels `_common.md` §2 |
| Paging | `Button` outline "โหลดเพิ่ม" (mobile) / `Pagination` (desktop) | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | งานของฉัน |
| Header subtitle | งานที่คุณแจ้งและติดตาม |
| Search placeholder | ค้นหาเลขงาน หรือสถานที่ |
| Filter button aria-label | ตัวกรอง |
| Tabs | กำลังดำเนินการ {n} · รอตรวจรับ {n} · ปิดแล้ว |
| Filter sheet | title: ตัวกรอง · ช่วงวันที่แจ้ง: ทั้งหมด / 7 วันล่าสุด / 30 วันล่าสุด / 90 วันล่าสุด · งานที่แสดง: ทั้งหมด / ที่ฉันแจ้ง / ที่ฉันติดตาม · buttons: ล้างตัวกรอง / ใช้ตัวกรอง |
| Row meta | in_progress: ช่าง{ชื่อ} · {time} · new: แจ้งเมื่อ {time} · followed: คุณติดตามเคสนี้ · {time} · closed: {closed-reason caption} · {time} |
| Awaiting card | as S02 (badge รอคุณตรวจรับ, ปิดอัตโนมัติ {d MMM} หากไม่ตรวจรับ, ส่งกลับให้แก้ / ตรวจรับงาน) |
| Desktop columns | เลขงาน · เรื่อง / สถานที่ · หมวดงาน · ความเร่งด่วน · สถานะ · อัปเดตล่าสุด |
| Desktop row actions | ตรวจรับงาน · ดู |
| Paging | โหลดเพิ่ม · แสดง {a}–{b} จาก {n} งาน |
| Empty — no tickets at all | ยังไม่มีงานที่คุณแจ้ง / เจออะไรเสีย ถ่ายรูปแล้วแจ้ง BAMBAM ได้เลย หรือสแกน QR ที่ติดบนอุปกรณ์ / button แจ้งซ่อม |
| Empty — tab | กำลังดำเนินการ: ไม่มีงานที่กำลังดำเนินการ · รอตรวจรับ: ไม่มีงานรอตรวจรับ · ปิดแล้ว: ยังไม่มีงานที่ปิดแล้ว |
| Empty — search / filter | ไม่พบงานที่ตรงกับ "{q}" (filter only: ไม่พบงานตามตัวกรองนี้) / button ล้างการค้นหา (or ล้างตัวกรอง) |
| Error | Alert: โหลดงานของคุณไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button ลองอีกครั้ง |

## States

| State | What shows |
|---|---|
| Loading | Header + search render at once; skeleton tabs (3 pills) and 5 skeleton rows (mobile) / 6 table rows (desktop). "โหลดเพิ่ม" shows a spinner. |
| Empty | No tickets at all → mascot empty card (copy above) instead of tabs. Tab empty → small empty card with mascot `face` 64px and the tab text, no button. Search/filter empty → small card + clear button. |
| Error | Inline Alert under the tabs + full-width "ลองอีกครั้ง". Search and tabs stay usable. |
| Forbidden | — (every role). |
| Success feedback | Returning from S08 after confirming → the ticket moves to ปิดแล้ว; counts update. |

## Interactions

- Tap a row / table row → S07 `/repair/tickets/{id}`.
- Awaiting card buttons → S07 with `?action=confirm` or `?action=sendback`.
- Tabs, search, filters update the URL query, so back/forward and refresh keep them.
- Search runs after 300 ms idle, across all tabs' data but shows results in the active tab; tab counts reflect the search.
- Pull-to-refresh: not in phase 1 (design-system). Data refreshes when the page regains focus.
- Validation: search max 50 characters (input stops accepting more).

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Mobile follows the layout above with option-a list/awaiting card look; desktop follows the option-a table card
- [ ] Default tab rule and ordering rules above (BR-F06-2)
- [ ] Only tickets I reported or follow appear (mock data includes one followed ticket)
- [ ] All empty variants, error and loading states with the exact copy
- [ ] Tabs / search / filters live in the URL
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (tabs are a `tablist`, rows are links with the title as name)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
