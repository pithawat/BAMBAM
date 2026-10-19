# S10 — บันทึกผลซ่อม

Status: APPROVED (2026-10-14)

> **CR-008 (approved 2026-10-16):** opened as a sheet from the S07 action card (`บันทึกผลซ่อม` / `บันทึกผลการแก้ไข`); the `/repair/tickets/[id]/resolve` page stays for direct links. Layout: `ก่อนซ่อม · จากผู้แจ้ง` photo, then `หลังซ่อม *` camera tile `ถ่ายรูปหลังซ่อม` (thumbs + `ถ่ายเพิ่ม` afterwards) · hint `ถ่ายมุมเดียวกับรูปก่อนซ่อม ผู้แจ้งจะเทียบได้ทันที` · `ทำอะไรไป *` · contractor stars for contractor jobs · `ส่งผลการซ่อม`. Mockup: `../../changes/CR-008/ticket-detail.html`.


> **CR-005 / CR-006 (2026-10-15):** page `/repair/tickets/[id]/resolve` (`resolve-form.tsx`). The summary card shows the expected date and the ผู้ดำเนินการ chosen in the assessment (S17); no choice here (CR-006). Fields: สิ่งที่ทำ* (≤ 500), รูปหลังซ่อม* (1–5). **Contractor job only:** **คะแนนช่างภายนอก*** stars (hint "เห็นเฉพาะช่าง Admin และผู้บริหาร"; if a score already exists from an earlier resolve it is optional and replaces the old one), ความเห็นต่อช่างภายนอก. Errors: กรุณาบอกสิ่งที่ทำ · แนบรูปหลังซ่อมอย่างน้อย 1 รูป · ให้คะแนนช่างภายนอก. Not allowed / not assessed → forbidden state with the reason. Success → toast "บันทึกผลซ่อมแล้ว ผู้แจ้งจะได้รับแจ้งให้ประเมิน" and back to S07.


- **Flows:** F21 "บันทึกผล: สิ่งที่ทำ + รูปหลังซ่อม → resolved", BR-F21-4; "ทำต่อไม่ได้ → คืนงาน" entry (see ../../02-flows.md)
- **Persona:** technician on mobile, at the repaired spot (see ../../01-users.md)
- **Purpose of this screen (one sentence):** record what was done with after-repair photos so the reporter can confirm.
- **Route:** `/repair/tickets/[id]/resolve`
- **Mockup:** none. Closest: `../mockups/S03-report-form.html` (white top bar, form fields, PhotoPicker, sticky submit) + `../mockups/S07-ticket-detail.html` (header card)
- **Data:** ticket detail (summary + reporter photos); photo upload; resolve (what was done + photo ids) → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

## Layout — mobile first

```
┌────────────────────────────┐
│ [UAT strip — dev/UAT only]  │
│ ←     บันทึกผลซ่อม           │ ← white top bar
│┌──────────────────────────┐│ ← summary card (compact S07 header)
││ RP-2569-000138  [● ช่างกำลังดำเนินการ] ││
││ ไฟกะพริบ · ไฟไม่ติด            ││
││ 📍 อาคารหลัก ชั้น 3 · หน้าลิฟต์ฝั่งตะวันออก ││
││ รูปจากผู้แจ้ง [▢][▢]            ││ ← 56px thumbs, tap → lightbox
│└──────────────────────────┘│
│ สิ่งที่ทำ *                    │
│ [Textarea 5 rows    0/1000]  │
│ รูปหลังซ่อม *                  │
│ อย่างน้อย 1 รูป สูงสุด 5 รูป      │
│ [PhotoPicker]                │
│                              │
│ ทำต่อไม่ได้?  คืนงาน             │ ← Small + Button link → give-back dialog
├────────────────────────────┤
│ [       ส่งผลการซ่อม       ] │ ← sticky, Button default, full width
└────────────────────────────┘
```

Desktop (≥1024px): sidebar + top bar (title "บันทึกผลซ่อม", back link). Centered column 760px: summary card, then one form `Card`; button row right-aligned: "คืนงาน" (link, left side of the row) · "ยกเลิก" (outline) · "ส่งผลการซ่อม" (default).

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Top bar | white top bar | mobile |
| Summary | `Card` + status `Badge` + thumbnails + lightbox (S07) | |
| What was done | `Textarea` + counter | |
| Photos | `PhotoPicker` (`_common.md` §5) | required ≥ 1 |
| Give back | `Button` link + give-back dialog (`_common.md` §7) | |
| Submit | `Button` default, sticky bottom (mobile) | spinner + disabled while sending |
| Leave confirm | discard dialog (`_common.md` §7) | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | บันทึกผลซ่อม |
| Summary label | รูปจากผู้แจ้ง |
| Field labels | สิ่งที่ทำ * · รูปหลังซ่อม * |
| Placeholder | เช่น ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้ง ทดสอบแล้วเย็นปกติ |
| Photo hint | อย่างน้อย 1 รูป สูงสุด 5 รูป |
| Give back line | ทำต่อไม่ได้? · link คืนงาน |
| Submit | ส่งผลการซ่อม |
| Desktop cancel | ยกเลิก |
| Success toast | บันทึกผลแล้ว รอผู้แจ้งตรวจรับ |
| Error — ticket closed by admin | Alert destructive: งานนี้ถูกปิดโดย Admin แล้ว / ผลที่กรอกไว้ไม่ได้บันทึก · button กลับไปที่คิวงาน |
| Error — not holding this ticket | forbidden state: title คุณไม่มีสิทธิ์เข้าหน้านี้ · reason บันทึกผลได้เฉพาะช่างที่รับงานนี้ · button กลับไปที่คิวงาน |
| Error — send failed | Alert destructive above the bottom bar: ส่งไม่สำเร็จ / ลองอีกครั้ง ข้อมูลที่กรอกยังอยู่ครบ |

## States

| State | What shows |
|---|---|
| Loading | Skeleton summary card; form renders disabled until the ticket loads. |
| Empty | — |
| Error | Ticket load fails → whole-page error. Submit errors → messages above (input kept). |
| Forbidden | Viewer is not the technician holding the ticket, or status is not `in_progress` → forbidden (copy above). |
| Success feedback | Toast "บันทึกผลแล้ว รอผู้แจ้งตรวจรับ" → navigate to S09 (replace history). |

## Interactions

- Submit validates both fields, then sends → `resolved` → S09.
- "คืนงาน" → give-back dialog; on success toast "คืนงานแล้ว" → S09 (the typed result is dropped without asking — the dialog already confirmed).
- Back / leave with typed text or photos → discard dialog.
- Validation (field → rule → message):
  - สิ่งที่ทำ → required → กรุณาบอกสิ่งที่ทำ; max 1000 → ไม่เกิน 1000 ตัวอักษร
  - รูปหลังซ่อม → at least 1 (BR-F21-4) → แนบรูปหลังซ่อมอย่างน้อย 1 รูป · other photo messages `_common.md` §5

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Follows the layout at 375px and 1280px, matching the S03 form look and S07 header card
- [ ] Both fields required with the exact messages; photo upload errors per tile
- [ ] Give back from here works and returns to S09
- [ ] Forbidden when not the holder; closed-by-admin Alert on submit
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (labels, error text linked)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
