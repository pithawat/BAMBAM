# S07 — รายละเอียดงาน

Status: APPROVED (2026-10-14) · header card changed by CR-003 (approved 2026-10-14) · layout replaced by CR-011 (approved 2026-10-18) · **refined by CR-012 (approved 2026-10-19)**

> **CR-015 (approved 2026-10-19):** no priority `Select` / change-priority dialog / toast / `priority_changed` event for anyone, including admin; priority stays a read-only row for staff. Overrides any text below.

> **CR-012 (approved 2026-10-19) — replaces items 2–5 of the CR-011 block below (D-067).** Visual source: `output/ticket-detail-redesign/` minus its priority row.
> 1. **Heading** (no card): ticket no + copy · status tag (radius 5px, step colour + icon; closed = folder-check) · H1 title · `แจ้งเมื่อ {date} เวลา {time} น.` (CR-012)
> 2. **Reporter, awaiting rating, `confirm` allowed → review card** (white, full width): `ซ่อมเสร็จแล้ว งานซ่อมเป็นอย่างไรบ้าง?` / `ตรวจผลซ่อมด้านล่าง แล้วให้คะแนนความพึงพอใจ` · five empty stars (tap → S08 with that draft score) · `ประเมินพร้อมความคิดเห็น` (→ S08 without a score) · footer `ประเมินภายใน {date} เวลา {time} น. ก่อนระบบปิดงานอัตโนมัติ` + `ยังไม่เรียบร้อย · ส่งกลับให้แก้` (if `send_back` allowed). Hidden in print. **Everyone else → next-action card** (CR-011 texts and buttons, now a white card; the step colour stays on the icon only; no violet). (CR-012)
> 3. **ข้อมูลงาน:** pin + building name, sub-line `ชั้น {n} · {ห้องหรือจุดที่เกิด}` · rows `หมวดงาน` · `อาการ` (one tag per symptom + typed symptom) · `อุปกรณ์` (if any) · `ความเร่งด่วน` + reason **staff only** · `คาดว่าจะเสร็จ` / `ซ่อมเสร็จเมื่อ` / `ปิดงานเมื่อ` · contractor rating (staff) · footer `ผู้แจ้ง` (name, `(คุณ)` for the reporter, department · ผู้ติดตาม n คน) and `ผู้ซ่อม` (name + work-by, or `รอช่างรับงาน` / `จะแสดงเมื่อช่างเริ่มดำเนินการ`). Owner at approval: no priority for reporter / follower — show the symptoms instead. (CR-012)
> 4. **รายละเอียดการซ่อม** (`ผลซ่อมครั้งก่อน` during rework) + state (`บันทึกผลแล้ว` / `รอผลการซ่อม` / `อยู่ระหว่างแก้ไข` / `ไม่มีบันทึกผลซ่อม`): `สิ่งที่ช่างดำเนินการ` note + `{name} · {date} เวลา {time} น.` (or the waiting / closed-without-result text) · send-back reason during rework · `ก่อนซ่อม` (จากคุณ / จากผู้แจ้ง) and `หลังซ่อม` (จากช่าง) side by side, stacked on phones: one 4:3 photo + thumbnail strip + lightbox; empty → `ไม่มีรูปแนบ` / `ไม่มีรูปหลังซ่อม` / `รอช่างบันทึกผลการซ่อม` · `รายละเอียดที่แจ้ง` + `แจ้งโดย…` · closed by rating → `คะแนนจาก{คุณ/ผู้แจ้ง} n/5 · {label}` + comment (no stars). (CR-012)
> 5. **Timeline:** every done marker and rail blue with a white check, current marker blue ring (rework included), future muted; `ตอนนี้` tag radius 5px. (CR-012)

> **CR-011 (approved 2026-10-18) — replaces the CR-009 / CR-008 layouts below (D-065).** Visual source: `output/navbar-redesign/ticket-detail.html`. Wording, stages and actions from CR-009 stay.
> 1. Breadcrumb `หน้าแรก › แจ้งซ่อม · ติดตามงานซ่อม › รายละเอียดงาน` (technician: `งานซ่อม`) · back link `กลับไปติดตามงานซ่อม` (keeps the S06 filters) · `พิมพ์งานนี้`. (CR-011)
> 2. **Summary card:** ticket no + copy · status badge (violet `รอคุณประเมินตรวจงาน` for the reporter) · H1 title · location (building · ชั้น · room). Facts — reporter / follower: `คาดว่าจะเสร็จ` (`รอช่างกำหนด`, `รอช่างกำหนดวันใหม่` after a send back) or `ซ่อมเสร็จเมื่อ` / `ปิดงานเมื่อ` · `ประเภทงาน` · `ความเกี่ยวข้องกับงาน` (`คุณเป็นผู้แจ้ง` / `คุณติดตามงานนี้` + who evaluates). Technician / staff keep `แจ้งเมื่อ` · date · `ผู้ซ่อม` · `ผู้แจ้ง` + หมวดงาน · อุปกรณ์ · ความเร่งด่วน (+ reason) · contractor rating. (CR-011)
> 3. **Next-action panel** inside the card (blue in progress, orange rework, violet awaiting rating, green closed): title + what happens next; date change `เลื่อนจาก … เป็น … · เหตุผล: …`; reporter awaiting rating: `ประเมินตรวจงาน` (violet, opens the rating dialog with no score) + `ส่งกลับให้แก้` + auto-close note; follower: information only, never buttons; technician actions unchanged; closed text says how it closed (rating / auto-close without score / Admin / team) — never calls an automatic or admin close an evaluation. Buttons only from `allowedActions`. (CR-011)
> 4. **Evidence card:** `ผลการซ่อม` (or `ผลซ่อมครั้งก่อน` during rework: note, `บันทึกโดย {name} · {date}`, photos, rating or send-back reason) then `รายละเอียดที่แจ้ง` (details, `แจ้งโดยคุณ / {name} · {date}`, photos); no photos → `ไม่มีรูปแนบ` / `ไม่มีรูปหลังซ่อม`. Photos open the lightbox. (CR-011)
> 5. **Timeline** (right column on desktop, sticky below the navbar; after the evidence on phones): `ความคืบหน้าของงาน` / `ตั้งแต่แจ้งเรื่อง จนถึงปิดงาน`, CR-009 stages with real timestamps only (planned `คาดว่า …`), solid done / outlined current / muted future markers, `ดูประวัติทั้งหมด` (outline, full width) → history dialog. Reporter / follower never see priority events (timeline, history, print). (CR-011)
> 6. States unchanged: loading skeleton · not found · forbidden · error. Print: A4, navbar / buttons hidden. (CR-011)

> **CR-009 (approved 2026-10-18) — replaces the CR-008 layout below.** Visual source of truth: `../../changes/CR-008/ticket-detail.html` **as it is on disk (design demo 05 layout)**: back link + ticket no (copy) · header (status badge, title, `แจ้งเมื่อ …`, `พิมพ์รายงาน`) · `next-action` card per viewer (soft violet; green when closed; actions from `allowedActions`: technician `เริ่มดำเนินการ` / `บันทึกผลซ่อม` + `เลื่อนวันเสร็จ`; reporter quick stars + `ส่งกลับให้แก้`) · two columns on desktop (≥ 1100px): left `ข้อมูลงาน` (room headline + building · floor, properties หมวดงาน · อุปกรณ์ · ความเร่งด่วน (+ จากอาการ “…”) · คาดว่าจะเสร็จ / ซ่อมเสร็จเมื่อ, people ผู้แจ้ง · ผู้ซ่อม — the fixer's name only after เริ่มดำเนินการ) and `รายละเอียดและผลการซ่อม` (ก่อนซ่อม | หลังซ่อม side by side; phones switch with a segmented `ก่อนซ่อม | หลังซ่อม`; rating / send-back note under it), right `ความคืบหน้างาน` (sticky): 5 stages แจ้งงาน · รับเรื่อง · กำลังดำเนินการ · (ส่งกลับให้แก้) · เสร็จ · ประเมินตรวจงาน, `สิ่งที่ต้องทำต่อ` box, `ดูประวัติทั้งหมด` dialog. Below 1100px one column. Print: A4 with facts, both photo columns, full history table, sign-off lines. ขั้นตอน (CR-009): แจ้งงาน → **รับเรื่อง** (ทันทีที่ส่ง, `awaiting_assessment`) → **กำลังดำเนินการ** (`in_repair`) → **ส่งกลับให้แก้** (`reworking`, เฉพาะเมื่อถูกส่งกลับ) → **เสร็จ · รอประเมินตรวจงาน** (`awaiting_rating`; ผู้แจ้งเห็น `รอคุณประเมินตรวจงาน`) → **ปิดงานแล้ว** (`closed`). ปุ่มช่าง `เริ่มดำเนินการ` (กำหนดวันเสร็จ + ใครซ่อม) · ปุ่มผู้แจ้ง `ประเมินตรวจงาน` (ดาว 1–5).


> **CR-008 (approved 2026-10-16) — replaces the layout of this spec.** Visual source of truth: `../../changes/CR-008/ticket-detail.html` (design demo 06). One column (max 820px), top to bottom:
> 1. Back link (`กลับไปติดตามงานซ่อม`; technician `กลับไปงานซ่อม`) + `พิมพ์รายงาน`.
> 2. **Header card**: solid status band in the step colour (`รอช่างรับเรื่อง` amber · `กำลังซ่อม` blue · `กำลังแก้ไขตามที่ส่งกลับ` orange · `ซ่อมเสร็จ รอคุณให้คะแนน` / `ซ่อมเสร็จ รอผู้แจ้งให้คะแนน` violet · `ปิดงานแล้ว` green) with icon, ticket no + copy; title; room as headline + building · floor; `แจ้งเมื่อ … · โดย คุณ / {ชื่อ}`.
> 3. **"สิ่งที่ต้องทำตอนนี้" card** (solid step colour, white text) per viewer and step; actions come from `allowedActions`: reporter waiting for rating → 5 large stars (no default; a tap opens S08 with that score) + `ยังไม่เรียบร้อย ส่งกลับให้แก้` + chip `ปิดเองอัตโนมัติ {d MMM HH:mm} ถ้าไม่ได้ตอบ`; reporter in other steps → what happens next, no buttons; follower → `คุณติดตามงานนี้` … `ผู้แจ้งเป็นคนให้คะแนนเมื่อซ่อมเสร็จ`; technician → `รับเรื่อง` (S17) · `บันทึกผลซ่อม` (S10) + `เลื่อนวันเสร็จ` · after a send back `กำหนดวันใหม่` + `บันทึกผลอีกครั้ง` · waiting / closed info.
> 4. **ความคืบหน้า**: 4 stages แจ้งซ่อม · ช่างรับเรื่อง · ซ่อม · ให้คะแนนและปิดงาน (done = blue check + time, current = step colour + `ตอนนี้ · …`, later = number + what will happen). Smaller events nested under their stage (follower added, `เลื่อนวันเสร็จ · จาก … เป็น … · {เหตุผล}`, `ส่งกลับให้แก้ · “…”`, `ช่างรับแก้ไข`, an earlier resolve). No separate history list on screen (the print report has the full table).
> 5. **ข้อมูลงาน**: หมวดงาน · ความเร่งด่วน (badge + `ระบบกำหนดจากอาการ “…”`) · อุปกรณ์ · คาดว่าจะเสร็จ / ซ่อมเสร็จเมื่อ · ผู้แจ้ง (+ ผู้ติดตาม {n} คน) · ผู้ซ่อม (`ช่างของบริษัท` / `ช่างภายนอก · {ประเภท}`; contractor name for staff only).
> 6. **รูปและผลการซ่อม**: `ก่อนซ่อม` card (large photo 16:9, thumbs, text) then `หลังซ่อม` card (or a dashed placeholder until resolved; `ผลซ่อมครั้งก่อน` + send-back reason while reworking; the reporter's rating at the bottom when closed). Lightbox on tap.
> 7. Print (A4, `@media print`): header, facts, photos, full history table, sign-off lines ผู้แจ้ง · ผู้ซ่อม · ผู้อนุมัติ.


> **CR-005 (2026-10-15):** badge from `step` (`STEP` labels in `ticket-presentation.ts`); "รอคุณตรวจรับ" → "รอคุณประเมิน"; chip "คาดว่าจะเสร็จ {d MMM yyyy}" while in progress; result card adds "ผู้ดำเนินการ" (ช่างในระบบ / ช่างภายนอก · {types}, + name for staff) and, for staff, the contractor score; reporter score titled "คะแนนจากผู้แจ้ง". Info rows: ช่างผู้รับผิดชอบ ("รอช่างประเมิน" when empty), คาดว่าจะเสร็จ, ผู้ดำเนินการ, ส่งกลับให้แก้ (when > 0). Action bar (desktop aside + mobile bottom bar, dialogs rendered once): technician → **ประเมินงาน / เลื่อนวันคาดว่าเสร็จ** (S17), **บันทึกผลซ่อม** (→ S10, disabled with "ประเมินงาน (วันที่คาดว่าจะเสร็จ) ก่อนบันทึกผล" until assessed); reporter → **ส่งกลับให้แก้**, **ประเมินงาน** (S08). Timeline types: assessed / assessment_changed (คาดว่าจะเสร็จ …), resolved (ดำเนินการโดย …), sent_back, confirmed. Reserved-job and queue-move UI removed.


**CR-003 header card:** ticket no + copy · status badge (or solid "รอคุณตรวจรับ") · extra badges · title · one meta line (หมวดงาน · priority · location) · asset · the 4-step progress tracker from S06 (`TicketProgress`, captions per S06 "Progress tracker") · awaiting-mine deadline chip. Desktop: รายละเอียดจากผู้แจ้ง and ผลการซ่อม side by side from `2xl`. Visual reference: the S06 desktop preview pane (`../mockups/S06-my-tickets.html`); `../mockups/S07-ticket-detail.html` stays the reference for everything else.

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
| Auto-close notice (CR-003) | same deadline chip as S06: ปิดอัตโนมัติใน {n} วัน ({d MMM}) หากไม่ตรวจรับ · less than 1 day: ปิดอัตโนมัติวันนี้ {HH:mm} หากไม่ตรวจรับ |
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
