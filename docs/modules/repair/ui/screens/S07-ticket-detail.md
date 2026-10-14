# S07 — รายละเอียดงาน

Status: APPROVED (2026-10-14)

- **Flows:** F06 (detail + timeline), F07 entry, F05 (hand over), F08-B (admin close), F21 (claim, start reserved, give back, go to record result), F22 (priority change) (see ../../02-flows.md)
- **Persona:** every role; reporter and technician on mobile, admin and executive on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** show everything about one ticket and offer exactly the actions this viewer may take in its current state.
- **Route:** `/repair/tickets/[id]` · `?action=confirm|sendback` opens S08 on load
- **Mockup:** `../mockups/S07-ticket-detail.html` (reporter on resolved ticket, technician on new / in_progress, admin desktop, executive read-only, S08 sheets)
- **Data:** ticket detail incl. photos, result, rating, timeline, allowed actions for the viewer; action calls (claim, start, give back, hand over, close, change priority) → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

**The server decides which actions the viewer has** (field like `allowedActions`); the UI only renders them. The table below is what the server is expected to return — the UI must not re-implement these rules.

## Actions by viewer and status

| Viewer | Ticket | Actions shown (primary first) |
|---|---|---|
| Reporter | `resolved` | ตรวจรับงาน · ส่งกลับให้แก้ → S08 |
| Team lead who recorded it, or admin | `closed` + `team_handled` | ส่งต่อให้ช่าง (dialog, `_common.md` §7) |
| Technician of the category | `new`, not reserved, not holding a job | รับงาน (claim dialog) |
| Technician of the category | `new`, not reserved, holding a job | รับงาน **disabled** + helper "จบงานปัจจุบันก่อน (บันทึกผล หรือ คืนงาน)" + link "ไปที่งานปัจจุบัน" |
| Technician it is reserved for | `new` reserved (sent back) | เริ่มงาน (disabled with the same helper while holding another job) |
| Technician holding it | `in_progress` | บันทึกผลซ่อม → S10 · คืนงาน (dialog) |
| Admin | `new` / `in_progress` / `resolved` | ปิดงาน (destructive outline) · ความเร่งด่วน `Select` in the info card |
| Executive | any | none — read-only note "ผู้บริหารดูได้อย่างเดียว" (desktop info card only) |
| Subscriber, other viewers | any | none |

## Layout — mobile first

```
┌────────────────────────────┐
│ [UAT strip — dev/UAT only]  │
│ ←     รายละเอียดงาน          │ ← white top bar
│┌──────────────────────────┐│ ← header card
││ RP-2569-000142 [⧉]  [● ซ่อมเสร็จ รอตรวจรับ] ││
││ [รอคุณตรวจรับ]  ปิดอัตโนมัติ 17 ต.ค. 2569 10:15 หากไม่ตรวจรับ ││
││ แอร์ไม่เย็น · มีน้ำหยด         ││ ← H2 (18), wraps
││ ระบบปรับอากาศ · ▮▮▮ สูง        ││
││ 📍 อาคารหลัก ชั้น 5 · ห้องประชุม 5B ││
││ 🏷 AC-05-012 เครื่องปรับอากาศ ห้องประชุม 5B ││ ← only when linked to an asset
│└──────────────────────────┘│
│┌ รายละเอียดจากผู้แจ้ง ───────┐│
││ น้ำหยดใส่โต๊ะประชุม เริ่มตั้งแต่เช้า ││
││ [▢][▢] (photos, 88px, tap → lightbox) ││
││ แจ้งโดย วรรณา สุขประเสริฐ · ฝ่ายบัญชี ││
││ 14 ต.ค. 2569 08:40 · ผู้ติดตาม 2 คน ││
│└──────────────────────────┘│
│┌ ผลการซ่อม (resolved/closed) ┐│
││ ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้ง… ││
││ [▢][▢] รูปหลังซ่อม            ││
││ ช่างธนากร พึ่งบุญ · 14 ต.ค. 2569 10:15 ││
││ (closed+confirmed) ★★★★★ ยอดเยี่ยม "ขอบคุณค่ะ" ││
│└──────────────────────────┘│
│┌ ความคืบหน้า (timeline) ────┐│
││ ● ช่างบันทึกผล  10:15         ││ ← newest first, icon circle 32px per event
││ │ ช่างธนากร พึ่งบุญ            ││
││ ● ช่างรับงาน   09:20         ││
││ ● แจ้งซ่อม     08:40         ││
│└──────────────────────────┘│
├────────────────────────────┤
│ [ส่งกลับให้แก้] [✓ ตรวจรับงาน] │ ← sticky action bar (only when actions exist)
└────────────────────────────┘
```

Action bar variants (mobile, sticky bottom, white, `shadow-nav`):
- one primary action → one full-width button
- two actions → outline (left, 40%) + default (right, 60%)
- disabled claim/start → button disabled + helper text above it (Caption, `text-warning`) + link "ไปที่งานปัจจุบัน"
- admin → "ปิดงาน" outline destructive full width (priority is changed in the header card: tap the priority → `Select` sheet)

Desktop (≥1024px): sidebar + top bar (title "รายละเอียดงาน", back link "‹ กลับ" before the title). Grid `minmax(0,1fr) 340px`, gap 18:
- left: header card, รายละเอียดจากผู้แจ้ง, ผลการซ่อม, ความคืบหน้า
- right (sticky): **actions card** (buttons stacked, full width; helper text; executive note) and **info card**: สถานะ, ความเร่งด่วน (admin: `Select`), หมวดงาน, สถานที่, อุปกรณ์, ผู้แจ้ง, ช่างผู้รับผิดชอบ, ผู้ติดตาม {n} คน, ส่งกลับให้แก้ {n} ครั้ง (admin/executive only, F07 Added by Claude), อัปเดตล่าสุด

## Timeline events (newest first)

| Event | Label | Extra line | Icon / color | Visible to |
|---|---|---|---|---|
| created | แจ้งซ่อม | {reporter} | `Plus` / primary | all |
| subscriber added | {name} ติดตามเคสนี้ | their note + photos (if any) | `Bookmark` / muted | all |
| claimed | ช่างรับงาน | ช่าง{name} | `Wrench` / status-in-progress | all |
| given back | ช่างคืนงาน | เหตุผล: {reason} | `Undo2` / status-new | all |
| resolved | ช่างบันทึกผล | ช่าง{name} | `ClipboardCheck` / status-resolved | all |
| sent back | ส่งกลับให้แก้ | เหตุผล: {reason} + photos; if reserved: "รอช่าง{name}เริ่มงาน" | `RotateCcw` / status-resolved | all |
| started reserved | ช่างเริ่มงานแก้ | ช่าง{name} | `Wrench` / status-in-progress | all |
| confirmed | ตรวจรับแล้ว | ★ {n} (when rated) | `CircleCheck` / status-closed | all |
| auto closed | ปิดอัตโนมัติ | ไม่ได้ตรวจรับภายใน 3 วัน | `Clock` / status-closed | all |
| team handled | ทีมดำเนินการเอง | {what the team did} + photos | `Users` / status-closed | all |
| handed over | ส่งต่อให้ช่าง | เหตุผล: {reason} | `Forward` / status-new | all |
| admin closed | Admin ปิดงาน | เหตุผล: {reason} | `CircleX` / destructive | all |
| priority changed | เปลี่ยนความเร่งด่วน | {จาก} → {ไป} โดย {name} | `Gauge` / muted | all |
| queue moved | เลื่อนลำดับคิว | {จากลำดับ} → {ไปลำดับ} โดย {name} | `ArrowUpDown` / muted | admin, executive only (BR-F06-3) |

Each event shows actor and full date-time (`14 ต.ค. 2569 10:15`). Photos in events open the lightbox.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Top bar | white top bar (mobile) / desktop top bar | |
| Header card | `Card` + ticket no + copy `Button` ghost icon + status `Badge` + extra badges (`_common.md` §2) + `PriorityIndicator` | |
| Photos | thumbnails radius 12 + `Dialog` lightbox (full screen, swipe / arrow keys, counter "1/3", close) | |
| Result | `Card` + stars (read-only, `Star` icons filled `text-warning`) | |
| Timeline | vertical list, 2px `border` line, icon circles 32px | |
| Action bar | sticky bottom bar (mobile) / actions `Card` (desktop) with `Button`s | |
| Priority change | `Select` + change-priority dialog (`_common.md` §7) | admin only |
| Dialogs | claim, give back, hand over, close (`_common.md` §7); S08 | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | รายละเอียดงาน |
| Section titles | รายละเอียดจากผู้แจ้ง · ผลการซ่อม · ความคืบหน้า |
| Header meta | แจ้งโดย {ชื่อ} · {ฝ่าย} · {date} · ผู้ติดตาม {n} คน |
| Auto-close notice | ปิดอัตโนมัติ {date time} หากไม่ตรวจรับ |
| Result meta | ช่าง{ชื่อเต็ม} · {date} · label for photos: รูปหลังซ่อม |
| Rating labels | 1 ต้องปรับปรุง · 2 พอใช้ · 3 ดี · 4 ดีมาก · 5 ยอดเยี่ยม |
| No details | ไม่มีรายละเอียดเพิ่มเติม |
| Buttons | ตรวจรับงาน · ส่งกลับให้แก้ · รับงาน · เริ่มงาน · บันทึกผลซ่อม · คืนงาน · ส่งต่อให้ช่าง · ปิดงาน |
| Holding helper | จบงานปัจจุบันก่อน (บันทึกผล หรือ คืนงาน) · link ไปที่งานปัจจุบัน |
| Executive note | ผู้บริหารดูได้อย่างเดียว |
| Info card labels (desktop) | สถานะ · ความเร่งด่วน · หมวดงาน · สถานที่ · อุปกรณ์ · ผู้แจ้ง · ช่างผู้รับผิดชอบ · ผู้ติดตาม · ส่งกลับให้แก้ · อัปเดตล่าสุด |
| Info values | ผู้ติดตาม {n} คน · ส่งกลับให้แก้ {n} ครั้ง · ช่างผู้รับผิดชอบ none: ยังไม่มี |
| Toasts | รับงานแล้ว · เริ่มงานแล้ว · คืนงานแล้ว · ส่งต่อให้ช่างแล้ว · ปิดงานแล้ว · เปลี่ยนความเร่งด่วนแล้ว · คัดลอกเลขงานแล้ว |
| Error — already claimed | toast: งานนี้มีช่างรับไปแล้ว → navigate to S09 |
| Error — holding another job | toast: จบงานปัจจุบันก่อน (บันทึกผล หรือ คืนงาน) → refresh |
| Error — state changed (ticket closed / status moved on) | Alert at top: งานนี้มีการเปลี่ยนแปลง / โหลดข้อมูลล่าสุดให้แล้ว → refresh |
| Error — action not allowed | toast: คุณไม่มีสิทธิ์ทำรายการนี้ → refresh |
| Forbidden reason | งานนี้ไม่ได้อยู่ในรายการที่คุณแจ้ง ติดตาม หรือรับผิดชอบ |

## States

| State | What shows |
|---|---|
| Loading | Skeleton: header card (3 lines), photo row (3 squares), timeline (4 rows); action bar hidden until loaded. |
| Empty | No photos in an event → nothing; no details → "ไม่มีรายละเอียดเพิ่มเติม"; result card hidden until resolved. |
| Error | Load fails → whole-page error. Action fails → messages above; data never partially updates (refetch after every action). |
| Forbidden | `_common.md` §6 with the reason above. Not found → ticket-not-found state. |
| Success feedback | Toast after each action, then the page refetches; give back / claim errors navigate as listed. |

## Interactions

- Copy button copies `ticket_no`.
- `?action=confirm` / `?action=sendback` → open S08 in that mode once the ticket loads (only if the action is allowed; otherwise ignore and remove the query).
- รับงาน → claim dialog → on success toast "รับงานแล้ว", page shows the holder actions.
- เริ่มงาน (reserved) → no dialog → toast "เริ่มงานแล้ว".
- บันทึกผลซ่อม → S10 `/repair/tickets/{id}/resolve`.
- คืนงาน → give-back dialog → toast → navigate to S09.
- ส่งต่อให้ช่าง → hand-over dialog → toast → page refetches (status `new`).
- ปิดงาน → close dialog → toast → refetch.
- Priority `Select` (admin) → change-priority dialog → toast → refetch. Cancel restores the old value.
- "ไปที่งานปัจจุบัน" → S07 of the held ticket.
- Back (top bar) → previous page, or S06 when opened directly.
- Data refreshes when the page regains focus.
- Validation: reason fields in dialogs (`_common.md` §7).

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches `S07-ticket-detail.html` at 375px and 1280px for every frame
- [ ] Actions come only from the server's allowed-actions field; every row of the actions table is covered by a mock ticket
- [ ] Disabled claim / start shows the helper and link
- [ ] Timeline shows all event types with the exact labels; queue moves only for admin / executive
- [ ] Lightbox works with touch and keyboard
- [ ] All dialogs keep typed text on failure and show the exact copy
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (action bar reachable, timeline is a list, status text not color-only)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
