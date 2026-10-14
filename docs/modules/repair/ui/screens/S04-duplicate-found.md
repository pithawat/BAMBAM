# S04 — พบงานซ้ำ

Status: APPROVED (2026-10-14)

- **Flows:** F03 (all), F04 BR-F04-3 (team-handled records also go through it) (see ../../02-flows.md)
- **Persona:** every role, mostly mobile (see ../../01-users.md)
- **Purpose of this screen (one sentence):** before a ticket is created, let the reporter follow an open case about the same problem instead of creating a duplicate.
- **Route:** none — bottom `Sheet` (mobile) / `Dialog` (desktop) opened by S03 after "ส่งแจ้งซ่อม"
- **Mockup:** `../mockups/S03-report-form.html` → frame "พบงานซ้ำ"
- **Data:** the duplicate list returned by the create call; "follow this case" (adds the form's details and photos to that case as an activity, BR-F03-3); "create anyway" → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

## Layout — mobile first

```
┌────────────────────────────┐
│ (S03 dimmed behind)         │
│┌──────────────────────────┐│ ← Sheet side=bottom, radius 26 top, max-height 88vh, scrolls
││        ▬▬ (handle)        ││
││ มีคนแจ้งเรื่องนี้ไว้แล้วหรือเปล่า? ✕││ ← H2 (18)
││ พบงานที่ยังไม่ปิดในหมวดและชั้นเดียวกัน ││ ← Small muted
││┌────────────────────────┐││ ← one Card per case, newest first
│││[img] RP-2569-000138  [● ช่างกำลังดำเนินการ]│││
│││ 64px แอร์ไม่เย็น · มีเสียงดัง     │││
│││      📍 อาคารหลัก ชั้น 5 · ห้องประชุม 5A │││
│││      🕘 แจ้งเมื่อ 09:05 · ผู้ติดตาม 2 คน │││
│││ [      ติดตามเคสนี้      ]   │││ ← Button default sm, full width
││└────────────────────────┘││
││ (more cases…)              ││
││ ข้อความและรูปที่คุณกรอกจะถูกเพิ่มในเคสที่เลือก ││ ← Caption, centered
││ [ ไม่ใช่เรื่องเดียวกัน แจ้งใหม่ ] ││ ← Button outline, full width
│└──────────────────────────┘│
└────────────────────────────┘
```

Desktop (≥1024px): `Dialog` 560px wide, same content; case cards in one column; footer row right-aligned: "ไม่ใช่เรื่องเดียวกัน แจ้งใหม่" (outline).

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Container | `Sheet` side bottom (mobile) / `Dialog` (desktop) | focus trapped; ✕ closes |
| Case card | `Card` + thumbnail (first photo, radius 12, 64px) + ticket no + status `Badge` + title + meta | tap thumbnail → lightbox |
| Follow button | `Button` default sm | spinner while sending |
| Create anyway | `Button` outline | |
| Own case / already following | `Badge` + `Button` outline sm "ดูเคสนี้" | see Interactions |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | มีคนแจ้งเรื่องนี้ไว้แล้วหรือเปล่า? |
| Subtitle | พบงานที่ยังไม่ปิดในหมวดและชั้นเดียวกัน |
| Case meta | แจ้งเมื่อ {date} · ผู้ติดตาม {n} คน (omit when 0) |
| Follow button | ติดตามเคสนี้ |
| Note | ข้อความและรูปที่คุณกรอกจะถูกเพิ่มในเคสที่เลือก |
| Create anyway | ไม่ใช่เรื่องเดียวกัน แจ้งใหม่ · team-handled: ไม่ใช่เรื่องเดียวกัน บันทึกงานทีม |
| Own case | badge: คุณแจ้งเคสนี้เอง · button: ดูเคสนี้ |
| Already following | badge: คุณติดตามเคสนี้อยู่แล้ว · button: ดูเคสนี้ |
| Follow success toast | คุณติดตามเคส {ticket_no} แล้ว |
| Case closed meanwhile | toast: เคสนี้ปิดไปแล้ว — the card is removed; if no card is left the sheet shows "ไม่มีเคสที่ยังเปิดอยู่แล้ว" and only the create button |
| Error | toast: ติดตามเคสไม่สำเร็จ ลองอีกครั้ง |

## States

| State | What shows |
|---|---|
| Loading | The list arrives with the S03 submit response — no separate load. Follow / create buttons show a spinner and disable the other buttons. |
| Empty | Only after cases disappear (closed meanwhile): "ไม่มีเคสที่ยังเปิดอยู่แล้ว" + create button. |
| Error | Toast (copy above); the sheet stays open. Create-anyway failure → close the sheet and show the S03 "ส่งไม่สำเร็จ" Alert. |
| Forbidden | — |
| Success feedback | Follow → toast + navigate to S07 of that case. Create anyway → S05. |

## Interactions

- "ติดตามเคสนี้" → follow (BR-F03-2): the reporter becomes a subscriber; the form's details and photos are added to that case as an activity (F03 "Added by Claude"). Then go to S07 `/repair/tickets/{id}` and show the toast. The S03 draft is discarded (no confirm).
- Team-handled draft + follow → same as above; nothing is closed and no team record is created.
- "ไม่ใช่เรื่องเดียวกัน แจ้งใหม่" / "… บันทึกงานทีม" → create the ticket from the same draft without checking duplicates again → S05.
- Case reported by the viewer → no follow button; "ดูเคสนี้" opens S07 in the same tab after the discard confirm (`_common.md` §7) because the draft would be lost.
- Already following → same as own case.
- ✕, swipe down, Esc or tapping the backdrop → close, back to S03 step 4 with all data; nothing created.
- Validation: none.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches the "พบงานซ้ำ" frame in `S03-report-form.html` at 375px and 1280px
- [ ] Cases newest first; each shows photo, ticket no, status badge, title, location, time
- [ ] Follow → toast + S07; create anyway → S05; close → back to S03 with data intact
- [ ] Own case / already-following variants render without a follow button
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (focus trap, Esc closes, dialog title announced)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
