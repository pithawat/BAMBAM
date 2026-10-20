# S11 — คิวงาน (Admin)

Status: APPROVED (2026-10-14)

> **CR-015 (approved 2026-10-19):** admin does **not** change priority — no priority `Select`, no change-priority dialog, no toast. Priority is shown as `PriorityIndicator` + the priority filter stays (information). Default order everywhere: oldest report first (`createdAt:asc`); closed tab newest closed first. Overrides any priority text below.

> **Stage 3 re-spec (built 2026-10-19, CR-005 + CR-015 — confirm at Stage 3 acceptance; overrides everything below):**
> - Title **งานทั้งหมด**, route `/repair/admin/queue?tab=assess|repair|rating|closed&category=&building=&priority=&reason=&q=&page=` (default tab `assess`, page 1; every filter change resets the page). Subtitle (phone) `ทุกงานแจ้งซ่อม เรียงตามเวลาแจ้ง (เก่าก่อน)`.
> - Toolbar card: search `ค้นหาเลขงาน หรือสถานที่` (ticket no / room / location, 300 ms) · FilterPill หมวดงาน (ทุกหมวด) · อาคาร (ทุกอาคาร) · ความเร่งด่วน (ทุกระดับ, information only) · closed tab adds เหตุผลที่ปิด (ทุกเหตุผล / ตรวจรับแล้ว / ปิดอัตโนมัติ / ทีมดำเนินการเอง / Admin ปิดงาน) · `ล้างตัวกรอง` when anything is set. Phones: pills scroll sideways.
> - Tabs (same steps and words as S09, CR-009): `รับเรื่อง {n}` (awaiting_assessment) · `กำลังดำเนินการ {n}` (in_repair + reworking) · `รอประเมินตรวจงาน {n}` (awaiting_rating) · `ปิดแล้ว`. Counts follow search + filters. Phones: the tab bar scrolls sideways.
> - Order: open tabs oldest report first (`createdAt:asc`, BR-F22-1); ปิดแล้ว newest closed first.
> - Desktop (≥ 1024px) table — always เลขงาน · เรื่อง / สถานที่ (title links to S07) · หมวดงาน, then per tab: รับเรื่อง → ความเร่งด่วน · ผู้แจ้ง · แจ้งเมื่อ; กำลังดำเนินการ → ความเร่งด่วน · ผู้ซ่อม · แจ้งเมื่อ · คาดว่าจะเสร็จ (`เลยกำหนด` red when late) · ส่งกลับ (`n ครั้ง`, blank at 0); รอประเมินตรวจงาน → ผู้ซ่อม · ซ่อมเสร็จเมื่อ · ปิดอัตโนมัติ; ปิดแล้ว → เหตุผลที่ปิด · คะแนน (`★ n` / –) · ปิดเมื่อ. Admin: ghost destructive `ปิดงาน` at the row end on open tabs → close dialog (`_common.md` §7) → toast `ปิดงานแล้ว` → list + counts refetch.
> - Phones: card rows (thumb, title + priority, category · place, ticket no · per-tab facts, `ปิดงาน` for admin).
> - Footer: `แสดง {a}–{b} จาก {n} งาน` + `ก่อนหน้า` / `หน้า x / y` / `ถัดไป` (20 per page).
> - Executive: strip `โหมดดูอย่างเดียว — ผู้บริหารดูงานได้ แต่ปิดงานหรือแก้ไขไม่ได้`, no close buttons (S07 shows none either).
> - States: skeleton rows; empty per tab (`ไม่มีงานที่รอช่างเริ่มดำเนินการ` · `ไม่มีงานที่ช่างกำลังดำเนินการ` · `ไม่มีงานที่รอผู้แจ้งประเมินตรวจงาน` · `ยังไม่มีงานที่ปิดแล้ว`); filtered empty `ไม่พบงานตามตัวกรองนี้` + `ล้างตัวกรอง`; error `โหลดงานทั้งหมดไม่สำเร็จ` + retry; forbidden `หน้านี้สำหรับ Admin และผู้บริหาร`. Refetch on window focus.
> - S07: admin gets an outline destructive `ปิดงาน` in the next-action card on every open ticket; back link returns to S11 with its filters (`กลับไปงานทั้งหมด`).
> - Not in Stage 3: hand over (Stage 4), notifications for the close (Stage 6 — the dialog text already promises them).

> **CR-005 (2026-10-15):** no queue → S11 becomes **งานทั้งหมด** (Stage 3): tabs by step, filters, priority change and close; drag and drop, "จัดลำดับเอง", undo and the reserved group are removed. Re-spec in Stage 3 before building.


- **Flows:** F22 (reorder, change priority), F08-B (close any ticket), F05 entry for admin (hand over team-handled tickets), BR-F06-1 (admin and executive see all tickets), BR-F22-6 (executive read-only) (see ../../02-flows.md)
- **Persona:** admin on desktop all day; executive on desktop, read-only (see ../../01-users.md)
- **Purpose of this screen (one sentence):** one place to see every ticket by status, keep each category's queue in the right order, and step in (priority, close, hand over).
- **Route:** `/repair/admin/queue` (`?tab=new|in_progress|resolved|closed&category=&building=&priority=&reason=&q=&page=`)
- **Mockup:** `../mockups/S11-admin-queue.html` (queue tab with drag, priority change, other tabs, closed tab with team-handled filter, executive read-only, mobile)
- **Data:** counts by status; queue of one category (reserved items first, then queue order, with manual-order info); ticket lists for other tabs (paged, filters); categories with counts and "has technician" flag; reorder (move to position / to top), change priority, close, hand over → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

## Layout — desktop first (≥1024px)

```
┌ sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ คิวงาน            [🔍 ค้นหาเลขงาน หรือสถานที่] [UAT ดูในบทบาท: Admin ▾] [🔔] │
│         │ (รอช่างรับ 14)(กำลังดำเนินการ 6)(รอตรวจรับ 3)(ปิดแล้ว)                    │ ← pill tabs + counts
│         │ ┌ หมวดงาน ──────┐ ┌ ระบบปรับอากาศ · 5 งานรอช่างรับ ───────────────────────┐│
│         │ │ ระบบปรับอากาศ 5 │ │ ลากเพื่อเลื่อนลำดับ หรือใช้เมนู ⋯                       ││ ← Caption hint
│         │ │ ไฟฟ้าฯ       4 │ │ จองไว้ให้ช่างเดิม (ส่งกลับให้แก้)                      ││ ← group, not draggable
│         │ │ ประปาฯ       3 │ │  —  RP-…0129 แอร์ไม่เย็น… [จองให้ช่างธนากร] ▮▮▮สูง  ⋯   ││
│         │ │ อาคารฯ       2 │ │ คิว                                                  ││
│         │ │ ความสะอาด ⚠  0 │ │ ⠿ 1 RP-…0146 น้ำรั่ว… ▮▮▮ฉุกเฉิน▾ 08:52            ⋯ ││ ← drag handle · order · id · title/location · priority Select · reported · menu
│         │ └──────────────┘ │ ⠿ 2 RP-…0141 แอร์มีเสียงดัง… [จัดลำดับเอง] ▮▮ปกติ▾ 13 ต.ค.  ⋯ ││
│         │                  │ ⠿ 3 …                                                ││
│         │                  └──────────────────────────────────────────────────────┘│
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

**Tab รอช่างรับ (`new`)** — reorder works per category (F22 step B):
- Left `Card` 240px "หมวดงาน": one row per category with its `new` count; selected = `bg-secondary`; ⚠ icon + tooltip "ยังไม่มีช่างรับผิดชอบ" when the category has no technician (F02 edge case). First category with items is selected by default.
- Right `Card`: header "{หมวดงาน} · {n} งานรอช่างรับ"; Alert (default) when the category has no technician; hint "ลากเพื่อเลื่อนลำดับ หรือใช้เมนู ⋯".
  - Group "จองไว้ให้ช่างเดิม (ส่งกลับให้แก้)" (only if any): reserved tickets (BR-F07-3), not draggable, order column "—", badge "จองให้ช่าง{ชื่อ}".
  - Group "คิว": `Table` rows in queue order. Columns: drag handle · ลำดับ · เลขงาน · เรื่อง / สถานที่ (+ badge "จัดลำดับเอง" when manually placed) · ความเร่งด่วน (`Select` for admin) · แจ้งเมื่อ · menu ⋯.
  - Row menu ⋯: ย้ายไปบนสุด · ย้ายขึ้น · ย้ายลง · (separator) · เปิดรายละเอียด · ปิดงาน.

**Tab กำลังดำเนินการ (`in_progress`)**, **รอตรวจรับ (`resolved`)**, **ปิดแล้ว (`closed`)** — full-width `Card`:
- filter row: หมวดงาน `Select` (ทุกหมวด) · อาคาร `Select` (ทุกอาคาร) · ความเร่งด่วน `Select` (ทุกระดับ) · closed tab adds เหตุผลที่ปิด `Select` (ทุกเหตุผล / ตรวจรับแล้ว / ปิดอัตโนมัติ / ทีมดำเนินการเอง / Admin ปิดงาน) and a toggle pill "เฉพาะงานทีมทำเอง" (shortcut for `reason=team_handled`)
- `Table` columns:

| Tab | Columns | Row action (admin) |
|---|---|---|
| กำลังดำเนินการ | เลขงาน · เรื่อง / สถานที่ · หมวดงาน · ความเร่งด่วน (`Select`) · ช่าง · รับงานเมื่อ · ส่งกลับ (n ครั้ง, blank when 0) | ⋯ เปิดรายละเอียด · ปิดงาน |
| รอตรวจรับ | เลขงาน · เรื่อง / สถานที่ · หมวดงาน · ช่าง · ซ่อมเสร็จเมื่อ · ปิดอัตโนมัติ | ⋯ เปิดรายละเอียด · ปิดงาน |
| ปิดแล้ว | เลขงาน · เรื่อง / สถานที่ · หมวดงาน · เหตุผลที่ปิด · คะแนน (★ n or –) · ปิดเมื่อ | "ส่งต่อให้ช่าง" outline sm on `team_handled` rows; ⋯ เปิดรายละเอียด |

- footer: `Pagination` 20 per page + "แสดง {a}–{b} จาก {n} งาน"
- default sort: กำลังดำเนินการ by priority then claim time (oldest first) · รอตรวจรับ by auto-close time (soonest first) · ปิดแล้ว newest first

**Search** (top bar) searches `ticket_no` and location across all tabs; results show in the active tab and the tab counts follow the search. In tab รอช่างรับ, search switches the right card to a flat result list (no drag) with a chip "ผลการค้นหา: {q} ✕".

**Executive (read-only, BR-F22-6):** same page; a muted strip under the tabs "โหมดดูอย่างเดียว — ผู้บริหารดูคิวได้ แต่จัดลำดับหรือแก้ไขไม่ได้"; no drag handles; priority shown as `PriorityIndicator` (no Select); menu has only "เปิดรายละเอียด"; no "ส่งต่อให้ช่าง" button.

Mobile (<1024px, secondary): white top bar "คิวงาน"; pill tabs (horizontal scroll); tab รอช่างรับ uses a category `Select` instead of the left card; list card rows (`_common.md` §4) with order number; no drag — the ⋯ menu (as a bottom `Sheet`) has ย้ายไปบนสุด / ย้ายขึ้น / ย้ายลง. Filters in a filter sheet like S06.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Tabs | pill `Tabs` with counts | |
| Category list | `Card` + list of buttons with counts + `TriangleAlert` icon + `Tooltip` | |
| Queue table | `Table` in `Card` + drag (`@dnd-kit/sortable`, keyboard sensor on) | library confirmed in `/stage-plan` |
| Drag handle | `Button` ghost icon `GripVertical`, aria-label "ลากเพื่อเลื่อนลำดับ" | |
| Priority | `Select` (admin) / `PriorityIndicator` (executive) | change-priority dialog (`_common.md` §7) |
| Row menu | `DropdownMenu` (desktop) / `Sheet` (mobile) | |
| Badges | "จองให้ช่าง{ชื่อ}", "จัดลำดับเอง" (`_common.md` §2) | tooltip on "จัดลำดับเอง" |
| Filters | `Select` ×3–4 + toggle pill | |
| Paging | `Pagination` | |
| Dialogs | close, hand over, change priority (`_common.md` §7) | |
| Toast with undo | `sonner` toast with action "เลิกทำ" | reorder only |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | คิวงาน |
| Tabs | รอช่างรับ {n} · กำลังดำเนินการ {n} · รอตรวจรับ {n} · ปิดแล้ว |
| Category card title | หมวดงาน |
| No technician tooltip / Alert | ยังไม่มีช่างรับผิดชอบ / Alert title: หมวดนี้ยังไม่มีช่างรับผิดชอบ · body: งานจะค้างในคิวจนกว่าจะกำหนดช่าง ติดต่อผู้ดูแลระบบ |
| Queue card header | {หมวดงาน} · {n} งานรอช่างรับ |
| Hint | ลากเพื่อเลื่อนลำดับ หรือใช้เมนู ⋯ |
| Groups | จองไว้ให้ช่างเดิม (ส่งกลับให้แก้) · คิว |
| Columns | ลำดับ · เลขงาน · เรื่อง / สถานที่ · หมวดงาน · ความเร่งด่วน · แจ้งเมื่อ · ช่าง · รับงานเมื่อ · ส่งกลับ · ซ่อมเสร็จเมื่อ · ปิดอัตโนมัติ · เหตุผลที่ปิด · คะแนน · ปิดเมื่อ |
| Cell values | ส่งกลับ: {n} ครั้ง · คะแนน: ★ {n} / – |
| Row menu | ย้ายไปบนสุด · ย้ายขึ้น · ย้ายลง · เปิดรายละเอียด · ปิดงาน |
| Filters | ทุกหมวด · ทุกอาคาร · ทุกระดับ · ทุกเหตุผล · ตรวจรับแล้ว · ปิดอัตโนมัติ · ทีมดำเนินการเอง · Admin ปิดงาน · toggle เฉพาะงานทีมทำเอง |
| Hand over button | ส่งต่อให้ช่าง |
| Executive strip | โหมดดูอย่างเดียว — ผู้บริหารดูคิวได้ แต่จัดลำดับหรือแก้ไขไม่ได้ |
| Search chip | ผลการค้นหา: {q} |
| Reorder toast | เลื่อนลำดับแล้ว · action เลิกทำ |
| Other toasts | เปลี่ยนความเร่งด่วนแล้ว · ปิดงานแล้ว · ส่งต่อให้ช่างแล้ว |
| Empty — category queue | ไม่มีงานรอช่างรับในหมวดนี้ |
| Empty — tab | กำลังดำเนินการ: ไม่มีงานที่ช่างกำลังทำ · รอตรวจรับ: ไม่มีงานรอตรวจรับ · ปิดแล้ว: ยังไม่มีงานที่ปิดแล้ว |
| Empty — filters | ไม่พบงานตามตัวกรองนี้ / button ล้างตัวกรอง |
| Error | Alert: โหลดคิวงานไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button ลองอีกครั้ง |
| Error — queue changed meanwhile | toast: ลำดับคิวเปลี่ยนไปแล้ว โหลดใหม่ให้แล้ว → refetch |
| Error — ticket claimed meanwhile | toast: งานนี้มีช่างรับไปแล้ว → refetch |
| Forbidden reason | หน้านี้สำหรับ Admin และผู้บริหาร |

## States

| State | What shows |
|---|---|
| Loading | Tabs with skeleton counts; category card skeleton (5 rows); table skeleton (6 rows). Drag disabled while a reorder request is running (row shows a spinner in the order cell). |
| Empty | Per tab / category / filter (copy above), small empty card with mascot `face` 64px. |
| Error | Inline Alert inside the card + "ลองอีกครั้ง"; tabs stay usable. |
| Forbidden | Roles other than admin / executive → `_common.md` §6 with the reason above. |
| Success feedback | Toasts; reorder is optimistic (row moves at once, rolls back with the error toast if the server refuses). |

## Interactions

- Drag a row (mouse, touch, or keyboard: focus handle → Space → arrows → Space) → new position is saved → toast "เลื่อนลำดับแล้ว" with "เลิกทำ" (moves it back; also logged).
- Menu ย้ายไปบนสุด / ย้ายขึ้น / ย้ายลง → same save + toast.
- Only `new` rows in the "คิว" group can move (BR-F22-5). Reserved rows and other tabs cannot.
- Manual order sticks; new tickets land after same-priority tickets (BR-F22-2) — UI just shows the server order after refetch.
- Priority `Select` → change-priority dialog → saved; the row jumps to its automatic position (BR-F22-4) and loses "จัดลำดับเอง".
- ปิดงาน (menu) → close dialog. ส่งต่อให้ช่าง (closed tab) → hand-over dialog.
- Row click (outside controls) → S07 in the same tab; back returns with tab/filters kept (URL query).
- Counts and the active list refetch on page focus and after every action.
- Validation: reasons in dialogs (`_common.md` §7).

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches `S11-admin-queue.html` at 1280px (all tabs, executive) and 375px
- [ ] Drag-and-drop works with mouse, touch and keyboard; menu moves work; undo works
- [ ] Reserved group is shown first and cannot be dragged
- [ ] Category without technician shows the ⚠ and Alert
- [ ] Closed tab filters by reason; "ส่งต่อให้ช่าง" only on team-handled rows, admin only
- [ ] Executive sees no edit controls at all
- [ ] Tab, filters, search and page live in the URL
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (drag announcements in Thai: "ย้าย {ticket_no} ไปลำดับ {n}")
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`) for admin and executive
