# S08 — ตรวจรับ / ส่งกลับให้แก้

Status: APPROVED (2026-10-14) · rating dialog refined by CR-012 (approved 2026-10-19)

> **CR-012 (approved 2026-10-19, D-067) — rating dialog:** title `ประเมินงานซ่อม` · context box (wrench, ticket title, `{จุดที่เกิด or อาคาร} · ชั้น {n} · ซ่อมเสร็จ {date}`) · `คุณพอใจกับงานซ่อมครั้งนี้แค่ไหน?` / `เลือกคะแนนที่ตรงกับประสบการณ์ของคุณ` · five star options with their number (radio group, arrows / Home / End), empty unless opened from a star on S07 · feedback `{n} / 5 · {label}` or `ยังไม่ได้เลือกคะแนน` · 1–2 stars keep the send-back hint · `มีอะไรอยากบอกเราเพิ่มเติม?` `ไม่บังคับ` · `เมื่อยืนยันผลประเมิน งานนี้จะถูกปิด` · full-width primary `ยืนยันผลประเมิน →`, disabled until a score is picked. Picking a star never submits. Toast unchanged. Send-back dialog unchanged.

> **CR-009 (approved 2026-10-18):** title `ประเมินตรวจงาน` · `งานซ่อมเรียบร้อยดีไหม เลือกคะแนน 1–5 ดาว แล้วงานนี้จะปิด` · button `ประเมินและปิดงาน` · toast `ขอบคุณที่ประเมินตรวจงาน งานนี้ปิดแล้ว`. Stars still empty by default; 1–2 stars → send-back hint.


> **CR-008 (approved 2026-10-16):** title `งานซ่อมเรียบร้อยดีไหม` · `เลือกคะแนน 1–5 ดาว แล้วงานนี้จะปิด` · stars start **empty** (or at the star tapped on S07) · label `{n} ดาว · {ต้องปรับปรุง…ยอดเยี่ยม}` · 1–2 stars → warning `ยังไม่เรียบร้อยใช่ไหม? ถ้ายังมีปัญหา ส่งกลับให้แก้แทนได้ ช่างจะกลับมาแก้ในงานเดิม` + link `ส่งกลับให้แก้แทน` · no score → `เลือกคะแนน 1–5 ดาวก่อน` · button `ให้คะแนนและปิดงาน`. Send back: `ส่งกลับให้ช่างแก้ไข` · `ยังพบปัญหาอะไร *`. Mockup: `../../changes/CR-008/ticket-detail.html`.


> **CR-005 (2026-10-15):** "ตรวจรับ" → **"ประเมินงาน"**: stars 1–5 are **required** ("กรุณาให้คะแนน"), comment optional ≤ 500; buttons "ไว้ทีหลัง" / "ส่งคะแนน". Send back: reason required ("กรุณาบอกสิ่งที่ยังไม่เรียบร้อย"), photos 0–5, button "ส่งกลับให้แก้" (destructive); after it the ticket moves on to "แก้ไขตามที่ส่งกลับ" (no reserved job). Both are dialogs from the S07 action bar (bottom sheet look on mobile).


- **Flows:** F07 (all), BR-F07-1 … BR-F07-3 (see ../../02-flows.md)
- **Persona:** the reporter only, mostly mobile (see ../../01-users.md)
- **Purpose of this screen (one sentence):** let the reporter accept the repair with an optional rating, or send it back to the same technician with a reason.
- **Route:** none — bottom `Sheet` (mobile) / `Dialog` (desktop) on S07, opened by its buttons or `?action=confirm|sendback`
- **Mockup:** `../mockups/S07-ticket-detail.html` → frames "ตรวจรับ" and "ส่งกลับให้แก้"
- **Data:** confirm (rating 1–5 optional, comment optional); send back (reason required, photos optional) → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

Two modes in the same container.

## Layout — mobile first

Confirm mode:

```
┌────────────────────────────┐
│┌──────────────────────────┐│ ← Sheet bottom, radius 26 top
││        ▬▬                 ││
││ ตรวจรับงาน              ✕ ││ ← H2 (18)
││ RP-2569-000142 · แอร์ไม่เย็น · มีน้ำหยด ││ ← Small muted, one line
││                          ││
││ ให้คะแนนการซ่อมครั้งนี้       ││ ← H3
││ ไม่บังคับ                   ││ ← Caption muted
││   ☆   ☆   ☆   ☆   ☆        ││ ← 5 stars, each 44px target, 32px icon
││        ดีมาก               ││ ← label of the chosen score
││ ความเห็นเพิ่มเติม             ││
││ [Textarea 3 rows   0/500] ││
││ [      ยืนยันตรวจรับ      ] ││ ← Button default, full width
│└──────────────────────────┘│
└────────────────────────────┘
```

Send-back mode:

```
││ ส่งกลับให้แก้            ✕ ││
││ (i) งานจะกลับไปที่ช่างธนากร   ││ ← Alert default, Small
││ สิ่งที่ยังไม่เรียบร้อย *        ││
││ [Textarea 4 rows   0/500] ││
││ รูปประกอบ                  ││
││ [PhotoPicker 0/5]          ││
││ [      ส่งกลับให้แก้      ] ││ ← Button default, full width
```

Desktop (≥1024px): `Dialog` 520px, same content; footer right-aligned: "ยกเลิก" (outline) + main button.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Container | `Sheet` bottom / `Dialog` | focus trapped, Esc closes |
| Stars | `RadioGroup` of 5 star buttons (`Star` lucide, filled `text-warning` when ≤ value) | tap the chosen star again to clear |
| Comment / reason | `Textarea` + counter | |
| Photos | `PhotoPicker` (`_common.md` §5) | send-back only, optional |
| Info | `Alert` default | send-back only |
| Submit | `Button` default | spinner + disabled while sending |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Confirm title | ตรวจรับงาน |
| Rating title / hint | ให้คะแนนการซ่อมครั้งนี้ / ไม่บังคับ |
| Rating labels | 1 ต้องปรับปรุง · 2 พอใช้ · 3 ดี · 4 ดีมาก · 5 ยอดเยี่ยม |
| Star aria-labels | ให้ {n} ดาว |
| Comment label / placeholder | ความเห็นเพิ่มเติม / เช่น ช่างมาไว และอธิบายสิ่งที่ทำ |
| Confirm button | ยืนยันตรวจรับ |
| Confirm toast | rated: ตรวจรับเรียบร้อย ขอบคุณที่ให้คะแนน · not rated: ตรวจรับเรียบร้อย |
| Send-back title | ส่งกลับให้แก้ |
| Send-back info | งานจะกลับไปที่ช่าง{ชื่อ} |
| Reason label / placeholder | สิ่งที่ยังไม่เรียบร้อย * / เช่น ยังมีน้ำหยดตอนเปิดแอร์เกิน 1 ชั่วโมง |
| Photos label | รูปประกอบ |
| Send-back button | ส่งกลับให้แก้ |
| Send-back toast | ส่งกลับให้ช่างแก้แล้ว |
| Desktop cancel | ยกเลิก |
| Error — not the reporter | toast: เฉพาะผู้แจ้งเท่านั้นที่ตรวจรับได้ → close, refetch S07 |
| Error — already closed (auto-closed / admin) | toast: งานนี้ปิดไปแล้ว → close, refetch S07 |
| Error — other | toast: ทำรายการไม่สำเร็จ ลองอีกครั้ง (sheet stays open, input kept) |

## States

| State | What shows |
|---|---|
| Loading | Nothing to load (data from S07). Submit → spinner in button. |
| Empty | — |
| Error | Toasts above. Field errors under fields. |
| Forbidden | Never opened unless S07 lists the action (BR-F07-1 enforced by the backend). |
| Success feedback | Toast, close, S07 refetches (status `closed` or `in_progress` / reserved). |

## Interactions

- Confirm without stars is allowed (BR-F07-2). Comment is allowed without stars.
- Send back → reason required (BR-F07-3); photos optional.
- Closing with typed text (✕, swipe, Esc, backdrop) → close without asking; the text is kept until S07 is left, so reopening the same mode shows it.
- Validation (field → rule → message):
  - สิ่งที่ยังไม่เรียบร้อย → required → กรุณาบอกสิ่งที่ยังไม่เรียบร้อย; max 500 → ไม่เกิน 500 ตัวอักษร
  - ความเห็นเพิ่มเติม → max 500 → ไม่เกิน 500 ตัวอักษร
  - photos → `_common.md` §5

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches the S08 frames in `S07-ticket-detail.html` at 375px and 1280px
- [ ] Confirm works with 0–5 stars; chosen star can be cleared
- [ ] Send back blocks submit without a reason; photos optional
- [ ] All error toasts with the exact copy; input kept on failure
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (stars operable with arrow keys, labelled)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
