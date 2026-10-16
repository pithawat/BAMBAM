# S05 — แจ้งสำเร็จ

Status: APPROVED (2026-10-14)

> **CR-005 (2026-10-15):** info box copy → "ส่งเรื่องถึงช่างแล้ว ช่างจะประเมินงานและแจ้งวันที่คาดว่าจะเสร็จ ติดตามได้ที่หน้าติดตามงานซ่อม" (no category queue).


- **Flows:** F02 last step ("หน้าแจ้งสำเร็จ + เลข Ticket"), F04 (team record closed at once) (see ../../02-flows.md)
- **Persona:** every role, mostly mobile (see ../../01-users.md)
- **Purpose of this screen (one sentence):** confirm the ticket exists, show its number, and say what happens next.
- **Route:** `/repair/new/done?id={ticketId}`
- **Mockup:** `../mockups/S03-report-form.html` → frames "แจ้งสำเร็จ" and "บันทึกงานทีมสำเร็จ"
- **Data:** ticket detail by id (same call as S07) → `modules/repair/api.ts`

## Layout — mobile first

```
┌────────────────────────────┐
│ bg-brand, circles (top 45%) │
│        [Mascot full 180px]  │
│┌──────────────────────────┐│ ← white card overlaps the gradient, radius 26
││        (✓) 56px success   ││ ← icon circle bg-success/10 text-success
││     แจ้งซ่อมเรียบร้อย       ││ ← H1
││   เลขงานของคุณ              ││ ← Small muted
││   RP-2569-000143  [⧉]     ││ ← Prompt 600 22px + copy button (icon, 44px)
││ ─────────────────────────  ││
││ หมวดงาน   ระบบปรับอากาศ     ││ ← summary rows, Small
││ อาการ     แอร์ไม่เย็น · มีน้ำหยด ││
││ สถานที่    อาคารหลัก ชั้น 5 · ห้องประชุม 5B ││
││ ความเร่งด่วน ▮▮▮ สูง          ││
││ ─────────────────────────  ││
││ (i) งานเข้าคิวช่างหมวดระบบปรับอากาศแล้ว ││ ← next step, Body
││     เราจะแจ้งเตือนเมื่อช่างรับงาน    ││
││ [        ดูงานนี้        ]  ││ ← Button default
││ [      กลับหน้าแรก       ]  ││ ← Button outline
│└──────────────────────────┘│
└────────────────────────────┘
```

Team-handled variant: title "บันทึกงานทีมเรียบร้อย"; status row shows `Badge` "ปิดงานแล้ว" + caption "ทีมดำเนินการเอง"; next-step text changes (copy below).

Desktop (≥1024px): sidebar + top bar (title "แจ้งซ่อม"); centered card 560px on the page background with mascot `full` 160px above the card (no gradient panel); same content.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Background | `bg-brand` top area (mobile) | only gradient surface on screen |
| Mascot | `Mascot` full | decorative |
| Card | `Card` radius-xl `shadow-float` | |
| Ticket number | Prompt 600 22px + `Button` ghost icon (`Copy`) | toast "คัดลอกเลขงานแล้ว" |
| Summary | definition rows + `PriorityIndicator` / status `Badge` | |
| Buttons | `Button` default + outline, full width (mobile) | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | แจ้งซ่อมเรียบร้อย · team: บันทึกงานทีมเรียบร้อย |
| Ticket label | เลขงานของคุณ |
| Summary labels | หมวดงาน · อาการ · สถานที่ · ความเร่งด่วน · team: สถานะ |
| Next step | งานเข้าคิวช่างหมวด{หมวดงาน}แล้ว เราจะแจ้งเตือนเมื่อช่างรับงาน |
| Next step (team) | งานนี้ปิดแล้วและนับเป็นผลงานของทีม หากต้องใช้ช่างภายหลัง กด "ส่งต่อให้ช่าง" ในหน้ารายละเอียดงาน |
| Buttons | ดูงานนี้ · กลับหน้าแรก |
| Copy toast | คัดลอกเลขงานแล้ว |
| Copy button aria-label | คัดลอกเลขงาน |

## States

| State | What shows |
|---|---|
| Loading | Skeleton card (icon circle, title bar, 4 rows, 2 buttons). |
| Empty | — |
| Error | Whole-page error (`_common.md` §6) with an extra outline button "ไปที่ติดตามงานซ่อม" (CR-003) — the ticket was already created. |
| Forbidden | Ticket not visible to this user (e.g. opened by someone else's link) → forbidden (`_common.md` §6), reason "หน้านี้แสดงเฉพาะงานที่คุณแจ้ง". |
| Success feedback | This screen is the feedback. |

## Interactions

- "ดูงานนี้" → S07 `/repair/tickets/{id}` (replace history, so back does not return here).
- "กลับหน้าแรก" → S02.
- Browser back from this screen goes to Home, never to the filled form.
- Copy button copies `ticket_no` to the clipboard.
- Validation: none.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches the success frames in `S03-report-form.html` at 375px and 1280px
- [ ] Normal and team-handled variants with the exact copy
- [ ] Back navigation never returns to the submitted form
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (title announced on load, copy button labelled)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
