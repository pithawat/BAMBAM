# S06 — ติดตามงานซ่อม

Status: APPROVED (2026-10-14) · redesigned by CR-002 · renamed by CR-003 (approved 2026-10-14) · **layout replaced by CR-011 (approved 2026-10-18)** · visual polish 2026-10-19 (D-068) · **layout replaced again by CR-019 (approved 2026-10-24)**

> **CR-019 (approved 2026-10-24) — replaces items 1–5 of the CR-011 block below; visual source `bam-workplace-mascot-v4-refined.html` (layout only, fonts / colours unchanged).**
> 1. **Top:** hero card (tracking mascot · eyebrow `MAINTENANCE CENTER` · H1 `ติดตามงานซ่อม` · sub-line) beside a primary CTA card (`พบปัญหาในที่ทำงาน?` / `แจ้งรายละเอียด เพื่อให้ทีมอาคารเข้าดูแล` / white `แจ้งซ่อมใหม่` → `/repair/new`); stacked on phones. No review banner, no "ภาพรวมงานคงค้าง" strip.
> 2. **Filters:** relation tabs (unchanged) · search · status dropdown `ทุกสถานะ · รับเรื่องแล้ว (awaiting_assessment) · กำลังดำเนินการ (in_repair + reworking) · รอประเมินตรวจงาน (resolved) · ปิดงานแล้ว (closed)` (`?status=`) · `เรียงลำดับ` (3 sorts, `?sort=`). Date-range filter removed. `แสดง {n} งาน` + `อัปเดตล่าสุด {time}`.
> 3. **One table** (no status groups): category icon tile + title + `{ticket no} · {category}` · สถานที่ · สถานะล่าสุด · กำหนด / อัปเดต · รายละเอียด (chevron; violet-tinted row + `ตรวจงาน` for the reporter's awaiting ticket, first in the list — BR-F06-2 by the API). Column names unchanged. Phone: title + place side by side, status / dates below.
> 4. **Paging:** 10 per page from #35 `GET /tickets/mine` (CR-019 follow-up 2026-10-24), `แสดง {a}–{b} จาก {n} งาน` + page numbers (`?page=`).

> **Polish 2026-10-19 (owner, D-068, no flow change):** desktop rows two lines tall (title one line, full text on hover; `{ticket no} · คุณติดตามงานนี้` on one line; 36px row link); closed caption `ประเมินตรวจงานแล้ว · {n}/5` (no star icon); `ปิดงานแล้ว` group icon = folder-check; status tags radius 5px.

> **CR-011 (approved 2026-10-18) — replaces the layout of this spec and of the 2026-10-18 UI pass (D-065).** Visual source: `output/navbar-redesign/repair-my.html` **without its status tiles** (owner at approval: no "เลือกสถานะเพื่อกรองรายการ" filter). Top to bottom:
> 1. **Heading:** white leopard bust (56px, decorative, D-066) · H1 `ติดตามงานซ่อม` · `งานที่คุณแจ้งและติดตาม · ดูความคืบหน้าและตรวจงานเมื่อซ่อมเสร็จ` · button `แจ้งซ่อมใหม่` (→ `/repair/new`; full width on phones). (CR-011)
> 2. **Review banner** (violet, only when `counts.awaitingMyConfirmation > 0` and the first resolved ticket in the current results is the viewer's): `ซ่อมเสร็จแล้ว · มี {n} งานรอคุณตรวจ` / `ตรวจผลการซ่อมและให้คะแนน เพื่อปิดงานที่คุณแจ้ง` / `ไปตรวจงาน` → that ticket's S07. Hidden while loading, on error / forbidden / empty. (CR-011)
> 3. **Workspace card:** relation tabs `ทั้งหมด · ที่ฉันแจ้ง · ที่ฉันติดตาม` (`?scope=`) · search `ค้นหาเลขงาน หรือสถานที่` (`?q=`, ticket no / location — the API does not search titles) · `วันที่แจ้ง` pill (ทั้งหมด / 7 / 30 / 90 วันล่าสุด, `?range=`) · `เรียง` pill (อัปเดตล่าสุดก่อน (default; closed = closedAt) / แจ้งล่าสุดก่อน / แจ้งเก่าสุดก่อน, `?sort=`) · `ล้างตัวกรอง` when any is set · hint `งานที่รอคุณประเมินแสดงก่อน · กดชื่อเรื่องหรือปุ่มท้ายแถวเพื่อดูรายละเอียด`. **No status filter.** (CR-011)
> 4. **Status groups** in this order, each hidden when its count is 0, collapsible (state kept while filters change), paged on its own (20, `โหลดเพิ่ม`): `รอประเมินตรวจงาน` (violet, `status=resolved`, viewer's own first — BR-F06-2) · `กำลังดำเนินการ` (blue, `in_progress`) · `ปิดงานแล้ว` (green, `closed`). Header: chevron · icon · name · `{n} งาน` · hint. Footer: `ทั้งหมด {n} งาน ใน {g} กลุ่ม`. (CR-011)
> 5. **Row** (desktop table / phone + tablet card): `เรื่องที่แจ้ง` (title link, ticket no, `คุณติดตามงานนี้` for followers) · `สถานที่` (building / ชั้น · room) · `สถานะล่าสุด` (CR-009 badge + caption: รอช่างกำหนดวันเสร็จ · ช่างกำลังดำเนินการ · ช่างแก้ไขตามที่ส่งกลับ · auto-close note or ตรวจผลซ่อมและให้คะแนน · รอผู้แจ้งประเมินตรวจงาน · rating or closed reason) · `กำหนด / อัปเดต` (คาดว่าจะเสร็จ date, `รอช่างกำหนด`, `ดูวันใหม่ในรายละเอียด` after a send back — the old date is never shown as the promise, `ซ่อมเสร็จแล้ว`; `อัปเดต {time}`) · `รายละเอียด`: violet `ตรวจงาน` for the reporter's awaiting ticket, else `ดูงาน`. No priority, contractor or staff fields. (CR-011)
> 6. **States:** loading skeleton groups · empty (no tickets, no filters) = existing EmptyState · filtered-empty `ไม่พบงานตามตัวกรองนี้` / `ไม่พบงานที่ตรงกับ "{q}"` + `ล้างตัวกรอง` · error inline retry · forbidden. Returning from S07 keeps the URL filters. (CR-011)

> **CR-009 (approved 2026-10-18):** labels — ขั้นตอน (CR-009): แจ้งงาน → **รับเรื่อง** (ทันทีที่ส่ง, `awaiting_assessment`) → **กำลังดำเนินการ** (`in_repair`) → **ส่งกลับให้แก้** (`reworking`, เฉพาะเมื่อถูกส่งกลับ) → **เสร็จ · รอประเมินตรวจงาน** (`awaiting_rating`; ผู้แจ้งเห็น `รอคุณประเมินตรวจงาน`) → **ปิดงานแล้ว** (`closed`). ปุ่มช่าง `เริ่มดำเนินการ` (กำหนดวันเสร็จ + ใครซ่อม) · ปุ่มผู้แจ้ง `ประเมินตรวจงาน` (ดาว 1–5). Group `รอคุณประเมินตรวจงาน`; awaiting card buttons `ส่งกลับให้แก้` + `ประเมินตรวจงาน`; tracker 5 steps แจ้งงาน · รับเรื่อง · กำลังดำเนินการ · เสร็จ · ประเมินตรวจงาน.


> **CR-008 (approved 2026-10-16):** restyle to the new tokens (no orange ServiceHeader; white top bar). Copy: group "รอประเมิน" → **"รอคุณให้คะแนน"**, step labels `รอช่างรับเรื่อง` · `กำลังซ่อม` (`คาดว่าเสร็จ {d MMM}`) · `กำลังแก้ไขตามที่ส่งกลับ` · `ซ่อมเสร็จ รอคุณให้คะแนน`; awaiting card buttons `ส่งกลับให้แก้` + `ให้คะแนน`; tracker steps แจ้งซ่อม · ช่างรับเรื่อง · ซ่อม · ให้คะแนน. Layout otherwise unchanged.


> **CR-005 (2026-10-15):** group "รอตรวจรับ" → **"รอประเมิน"**; "กำลังดำเนินการ" = status `in_progress` (no `new`). Row label / caption come from `step`: รอช่างประเมิน · กำลังซ่อม (คาดว่าเสร็จ {d MMM}) · กำลังแก้ไข · รอคุณประเมิน. Awaiting card buttons: "ส่งกลับให้แก้" + **"ประเมินงาน"** (star icon). Deadline chip: "… หากไม่ประเมิน". The progress tracker only moves forward: 4 steps (แจ้งแล้ว · ช่างประเมิน · ซ่อมเสร็จ · ปิดงาน), 6 after a send back (+ ส่งกลับให้แก้ · แก้ไขเสร็จ).


- **Flows:** F06 (list, search, filters, open detail), BR-F06-1, BR-F06-2 (see ../../02-flows.md)
- **Persona:** every role, mobile first (employee checking progress); desktop usable (see ../../01-users.md)
- **Purpose of this screen (one sentence):** list the tickets I reported or follow, with the ones waiting for my confirmation on top.
- **Route:** `/repair/my` (`?q=&range=&scope=` · `?closed=all` closed list · desktop `?id={ticketId}` selected ticket) (CR-002)
- **Mockup:** `../mockups/S06-my-tickets.html` (CR-002; research and the rejected option B: `../../changes/CR-002/S06-options.html`)
- **Data:** my tickets (reported + subscribed) per status group, filtered by search / date range / scope; group counts; desktop preview = ticket detail → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

Admin and executive see the same page with their own tickets. All tickets live in S11.

## Groups instead of tabs (CR-002)

One page, three status groups in this order. A group with 0 tickets is hidden.

| Group | Statuses | Shows | Order |
|---|---|---|---|
| รอตรวจรับ | `resolved` | tickets awaiting **my** confirmation as tinted awaiting cards (with actions), then followed ones as rows | awaiting-mine first, then latest update (server order) |
| กำลังดำเนินการ | `new`, `in_progress` | rows | latest update first |
| ปิดแล้ว | `closed` (any reason) | latest 3 as compact rows + "ดูทั้งหมด" | closed time, newest first |

Each group loads with its own `getTickets` call (`status` as above, same `q` / `createdFrom` / `relation`); counts come from `getTicketCounts`. "รอตรวจรับ" and "กำลังดำเนินการ" load 20 at a time with "โหลดเพิ่ม" under the group when there are more. `?closed=all` shows only the ปิดแล้ว group (20 per load, "โหลดเพิ่ม" + "แสดง {a} จาก {n} งาน") with a back link "‹ งานของฉัน".

## Layout — mobile first (CR-002)

```
┌────────────────────────────┐
│ ServiceHeader (repair, orange, curved) │
│ (🔧) ติดตามงานซ่อม              │
│      งานที่คุณแจ้งและติดตาม     │
│┌──────────────────────────┐│ ← search card overlaps header (shadow-float)
││ 🔍 ค้นหาเลขงาน หรือสถานที่ [⚙ 1]││ ← Input pill + filter button (count of active filters)
││ (ทั้งหมด)(ที่ฉันแจ้ง)(ที่ฉันติดตาม) ││ ← segmented control = scope
│└──────────────────────────┘│
│ รอตรวจรับ (2)                 │ ← group heading + count (count solid status-resolved when mine waits)
│┌ awaiting card (tinted) ────┐│
││ [img] น้ำรั่ว                 ││ ← 56px photo thumb · title · location
││       อาคารหลัก ชั้น 2 · ห้องน้ำหญิง… ││
││       RP-2569-000148 · ช่างวีระบันทึกผล 14:10 ││
││ (🕘 ปิดอัตโนมัติใน 3 วัน (17 ต.ค.) หากไม่ตรวจรับ) ││ ← deadline chip, warning tint
││ [ส่งกลับให้แก้] [✓ ตรวจรับงาน]  ││
│└──────────────────────────┘│
│┌ list card ────────────────┐│
││ [img] ฝ้าเพดานรั่ว           › ││ ← row: thumb · title · location
││       ▬▬▬▭ ซ่อมเสร็จ รอผู้แจ้งตรวจรับ ││ ← mini progress (4 segments) + step label + caption
││       🔖 คุณติดตามเคสนี้         ││
│└──────────────────────────┘│
│ กำลังดำเนินการ (3)            │
│┌ list card (rows as above) ─┐│
│ ปิดแล้ว (12)          ดูทั้งหมด › │
│┌ compact rows: (✓) ปลั๊กไม่มีไฟ  ★5 · 12 ต.ค. ┐│
├────────────────────────────┤
│ BottomNav (ติดตามงาน active)  │
└────────────────────────────┘
```

Filter sheet (bottom `Sheet`, opened by the filter button): ช่วงวันที่แจ้ง as a segmented control (ทั้งหมด · 7 วัน · 30 วัน · 90 วัน); footer "ล้างตัวกรอง" (link) + "ใช้ตัวกรอง" (default). Scope is not in the sheet any more — it is the segmented control on the page.

Desktop (≥1024px): sidebar + top bar (title "ติดตามงานซ่อม", search pill in the top bar). Two panes, full content height:
- **left list pane** (`Card`, 392px): scope segmented control · date-range `FilterPill` ("ช่วงวันที่: ทั้งหมด") · total caption "{n} งาน" · the three groups as compact rows (48px thumb, title, location, mini progress). Selected row: `bg-secondary` + 3px `primary` left bar (awaiting rows: status-resolved tint and bar). The pane scrolls on its own.
- **right preview pane** (`Card`): the selected ticket — ticket no + copy · badges · "เปิดหน้าเต็ม ›" (→ S07) · title · category · priority · location · **progress tracker** with step times · awaiting box (deadline + ส่งกลับให้แก้ / ตรวจรับงาน) · รายละเอียดจากผู้แจ้ง and ผลการซ่อม side by side · latest 3 timeline events + "ดูทั้งหมด" (→ S07).
- Default selection: `?id` if it is in the list, else the first awaiting-mine ticket, else the first row. Selecting a row updates `?id` (replace, no new history entry).

## Progress tracker (CR-002)

Four steps: แจ้งแล้ว · ช่างรับงาน · ซ่อมเสร็จ · ปิดงาน. Color = the ticket's status color. Done steps filled with a check, the current step ringed, later steps grey.

| Status | Current step | Mini label · caption (rows) | Full tracker captions (preview) |
|---|---|---|---|
| `new` | 1 | รอช่างรับงาน · แจ้งเมื่อ {list date} | แจ้งแล้ว {date} |
| `in_progress` | 2 | ช่างกำลังซ่อม · ช่าง{first name} · รับงาน {list date} | + ช่าง{first name} · {time} |
| `resolved`, awaiting me | 3 | รอคุณตรวจรับ · ปิดอัตโนมัติ {d MMM} | + {resolved date} · ปิดงาน: รอคุณตรวจรับ |
| `resolved`, other viewer | 3 | ซ่อมเสร็จ · รอผู้แจ้งตรวจรับ | + {resolved date} · ปิดงาน: รอผู้แจ้งตรวจรับ |
| `closed` | 4 (all done) | — (closed rows show the closed-reason caption) | + {closed date} |

Deadline chip (awaiting-mine only): `autoCloseAt` ≥ 1 day away → "ปิดอัตโนมัติใน {n} วัน ({d MMM}) หากไม่ตรวจรับ"; less than 1 day → "ปิดอัตโนมัติวันนี้ {HH:mm} หากไม่ตรวจรับ".

Thumbnail = `thumbUrl` (first report photo); none → status icon circle on `bg-muted`.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Header | `ServiceHeader` repair | mobile |
| Search | `Input` pill with `Search` icon, debounce 300 ms | searches `ticket_no` and location text |
| Scope | segmented control (`ToggleGroup` single, pill segments) (CR-002) | ทั้งหมด · ที่ฉันแจ้ง · ที่ฉันติดตาม |
| Date range | mobile: filter button + `Sheet` with a segmented control · desktop: `FilterPill` (CR-002) | |
| Awaiting card | tinted card + deadline chip + 2 buttons | design-system "รอคุณตรวจรับ" |
| Rows | list card rows with photo thumb + mini progress (CR-002) | closed: compact rows |
| Progress | `TicketProgress` / `TicketProgressMini` (module components) (CR-002) | |
| Desktop | list pane + preview pane (CR-002) | replaces the table |
| Status, priority | `Badge`, `PriorityIndicator` | labels `_common.md` §2 |
| Paging | `Button` outline "โหลดเพิ่ม" per group | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title (CR-003) | ติดตามงานซ่อม · bottom nav label: ติดตามงาน · sidebar: ติดตามงานซ่อม |
| Header subtitle | งานที่คุณแจ้งและติดตาม |
| Search placeholder | ค้นหาเลขงาน หรือสถานที่ |
| Filter button aria-label | ตัวกรอง (with count: ตัวกรอง ใช้อยู่ {n}) |
| Scope segments (CR-002) | ทั้งหมด · ที่ฉันแจ้ง · ที่ฉันติดตาม (aria-label of the group: งานที่แสดง) |
| Group headings (CR-002) | รอตรวจรับ · กำลังดำเนินการ · ปิดแล้ว |
| Closed link (CR-002) | ดูทั้งหมด · page: back link ติดตามงานซ่อม · desktop: ดูงานที่ปิดแล้วทั้งหมด |
| Filter sheet | title: ตัวกรอง · ช่วงวันที่แจ้ง: ทั้งหมด / 7 วัน / 30 วัน / 90 วัน (CR-002, short labels) · buttons: ล้างตัวกรอง / ใช้ตัวกรอง |
| Date FilterPill (desktop) (CR-002) | ช่วงวันที่: {ทั้งหมด / 7 วันล่าสุด / 30 วันล่าสุด / 90 วันล่าสุด} |
| Total caption (desktop) | {n} งาน |
| Mini progress | see "Progress tracker" |
| Awaiting card | รอคุณตรวจรับ (group) · {ticket no} · ช่าง{ชื่อ}บันทึกผล {time} · deadline chip (above) · ส่งกลับให้แก้ / ตรวจรับงาน |
| Followed tag | คุณติดตามเคสนี้ |
| Closed row caption | {closed-reason caption} · {date} (confirmed with rating: ★{n} · {date}) |
| Preview pane (CR-002) | เปิดหน้าเต็ม · รายละเอียดจากผู้แจ้ง · ผลการซ่อม · ความคืบหน้าล่าสุด · ดูทั้งหมด · awaiting box: ตรวจรับภายใน {d MMM} ไม่เช่นนั้นระบบปิดงานให้อัตโนมัติ |
| Paging | โหลดเพิ่ม · แสดง {a} จาก {n} งาน |
| Empty — no tickets at all | ยังไม่มีงานที่คุณแจ้ง / เจออะไรเสีย ถ่ายรูปแล้วแจ้ง BAMBAM ได้เลย หรือสแกน QR ที่ติดบนอุปกรณ์ / button แจ้งซ่อม |
| Empty — search / filter | ไม่พบงานที่ตรงกับ "{q}" (filter only: ไม่พบงานตามตัวกรองนี้) / button ล้างการค้นหา (or ล้างตัวกรอง) |
| Empty — preview pane | เลือกงานทางซ้ายเพื่อดูรายละเอียด |
| Error | Alert: โหลดงานของคุณไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button ลองอีกครั้ง |

## States

| State | What shows |
|---|---|
| Loading | Header + search render at once; skeleton: 1 group heading + awaiting-card block + 3 rows (mobile) / list-pane rows + preview block (desktop). "โหลดเพิ่ม" shows a spinner. |
| Empty | No tickets at all (no filters) → mascot empty card (copy above) instead of the groups. Search/filter with no result → small card + clear button. Preview pane with nothing selected → caption above. |
| Error | Inline Alert under the search card + full-width "ลองอีกครั้ง". Search and filters stay usable. Preview load error → same `TicketFailure` as S07 inside the pane. |
| Forbidden | — (every role). |
| Success feedback | Returning from S08 after confirming → the ticket moves to ปิดแล้ว; counts update. |

## Interactions

- Tap a row / awaiting card title → S07 `/repair/tickets/{id}` (mobile). Desktop: click selects the row and shows the preview; "เปิดหน้าเต็ม" → S07.
- Awaiting card buttons → S07 with `?action=confirm` or `?action=sendback`.
- Search, scope, date range and `closed` / `id` live in the URL, so back/forward and refresh keep them.
- Search runs after 300 ms idle across all groups; group counts reflect search and filters.
- Pull-to-refresh: not in phase 1 (design-system). Data refreshes when the page regains focus (loaded "โหลดเพิ่ม" pages are kept).
- Validation: search max 50 characters (input stops accepting more).

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Mobile follows the layout above (groups, awaiting card, rows with thumb + mini progress, closed preview); desktop follows the list + preview panes (CR-002)
- [ ] Group order and ordering rules above (BR-F06-2); empty groups hidden
- [ ] Only tickets I reported or follow appear (mock data includes one followed ticket)
- [ ] All empty variants, error and loading states with the exact copy
- [ ] Search / scope / date range / closed view / selected id live in the URL
- [ ] Uses only design-system tokens and shadcn components; date filter uses `FilterPill`, scope uses the segmented control
- [ ] Keyboard and screen-reader basics (group headings are headings, rows are links with the title as name, segmented control is a radio group, progress has a text equivalent)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
