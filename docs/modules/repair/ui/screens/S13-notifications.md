# S13 — แจ้งเตือน

Status: APPROVED (2026-10-14)

- **Flows:** F19-B (recipients table, BR-F19B-1, BR-F19B-2) (see ../../02-flows.md)
- **Persona:** every role; mobile first (see ../../01-users.md)
- **Purpose of this screen (one sentence):** list my own in-app notifications, newest first, and take me to the ticket each one is about.
- **Route:** `/notifications` (`app/(app)/notifications`) — platform route; repair supplies the message templates
- **Mockup:** none. Closest: `docs/shared/style/options/option-a.html` ("แจ้งเตือนล่าสุด" card: icon circle, text, time, unread dot) + its mobile list card
- **Data:** my notifications (paged), unread count, mark one read, mark all read → API names fixed in 04-api-contract.md

## Layout — mobile first

```
┌────────────────────────────┐
│ bg-brand short header (curved, circles)   │
│ แจ้งเตือน          [อ่านทั้งหมดแล้ว] │ ← H1 white + Button glass sm (hidden when 0 unread)
│ ยังไม่อ่าน 2 รายการ               │ ← Small, white/90
│┌──────────────────────────┐│ ← list card overlaps header
││ วันนี้                       ││ ← group label, Caption muted
││ (◉) ช่างบันทึกผล RP-2569-000142 แล้ว ● ││ ← unread: text 500 + dot bg-primary
││     กรุณาตรวจรับ               ││
││     10:15                    ││
││──────────────────────────││
││ (🔧) ช่างธนากร รับงาน RP-2569-000138 แล้ว ● ││
││     09:20                    ││
││ เมื่อวาน                      ││
││ (⌛) …                        ││
│└──────────────────────────┘│
│ [ โหลดเพิ่ม ]                 │
├────────────────────────────┤
│ BottomNav (แจ้งเตือน active)   │
└────────────────────────────┘
```

Groups: วันนี้ · เมื่อวาน · ก่อนหน้า. Icon circle 36px colored by the event (table below). Times per `_common.md` §3 (in "ก่อนหน้า" show `13 ต.ค. 16:48`).

Bell (S02 hero, desktop top bar): red count badge, `9+` above 9; hidden at 0. Bottom-nav item shows a red dot when unread > 0.

Desktop (≥1024px): sidebar ("แจ้งเตือน" active) + top bar (title "แจ้งเตือน", button "อ่านทั้งหมดแล้ว" outline sm at the right of the title). One `Card` max 760px with the same grouped rows; `Pagination` is replaced by "โหลดเพิ่ม".

## Messages (exact copy, F19-B)

| Event | Recipient | Text | Icon / color |
|---|---|---|---|
| New ticket in my category (incl. handover F05) | technician | งานใหม่ในหมวด{หมวดงาน}: {title} · {อาคาร} ชั้น {n} | `Inbox` / status-new |
| Technician claimed | reporter, subscribers | ช่าง{ชื่อ} รับงาน {ticket_no} แล้ว | `Wrench` / status-in-progress |
| Technician gave back | reporter, subscribers | ช่าง{ชื่อ} คืนงาน {ticket_no} งานกลับเข้าคิวรอช่างรับ | `Undo2` / status-new |
| Resolved | reporter | ช่างบันทึกผล {ticket_no} แล้ว กรุณาตรวจรับ | `ClipboardCheck` / status-resolved |
| Resolved | subscribers | {ticket_no} ซ่อมเสร็จแล้ว รอผู้แจ้งตรวจรับ | `ClipboardCheck` / status-resolved |
| Sent back | the same technician | ผู้แจ้งส่ง {ticket_no} กลับให้แก้: {reason, first 60 chars…} | `RotateCcw` / status-resolved |
| Auto-close reminder (1 day before) | reporter | {ticket_no} จะปิดอัตโนมัติ {d MMM HH:mm} หากไม่ตรวจรับ | `Clock` / warning |
| Auto-closed | reporter | {ticket_no} ปิดอัตโนมัติแล้ว เพราะไม่ได้ตรวจรับภายใน 3 วัน | `CircleCheck` / status-closed |
| Admin closed | reporter, subscribers, holding technician | Admin ปิดงาน {ticket_no}: {reason, first 60 chars…} | `CircleX` / destructive |

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Header | `bg-brand` short header + `Button` glass sm | mobile |
| List | `Card` + notification rows (`a-noti` look) + group labels | rows are links |
| Unread | text weight 500 + 8px dot `bg-primary` (with sr-only "ยังไม่อ่าน") | |
| Bell | bell button with count badge (`components/shared`) | used on S02 / top bar |
| Paging | `Button` outline "โหลดเพิ่ม" (30 per page) | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | แจ้งเตือน |
| Unread line | ยังไม่อ่าน {n} รายการ (hidden at 0) |
| Mark all | อ่านทั้งหมดแล้ว |
| Groups | วันนี้ · เมื่อวาน · ก่อนหน้า |
| Unread sr-only | ยังไม่อ่าน |
| Bell aria-label | แจ้งเตือน {n} รายการที่ยังไม่อ่าน (0 → แจ้งเตือน) |
| Load more | โหลดเพิ่ม |
| Empty | ยังไม่มีแจ้งเตือน / เมื่อมีความคืบหน้าของงาน เราจะแจ้งที่นี่ |
| Error | Alert: โหลดแจ้งเตือนไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button ลองอีกครั้ง |

## States

| State | What shows |
|---|---|
| Loading | Header renders; 6 skeleton rows (circle + 2 lines). |
| Empty | Mascot empty card (copy above), no button. |
| Error | Inline Alert + "ลองอีกครั้ง". Mark-all failing → toast "ทำรายการไม่สำเร็จ ลองอีกครั้ง". |
| Forbidden | — (every user sees only their own, BR-F19B-1). |
| Success feedback | Mark all → dots disappear, count 0, no toast. |

## Interactions

- Tap a row → mark it read → S07 of that ticket (BR-F19B-2). If the ticket is no longer visible, S07 shows its forbidden state.
- "อ่านทั้งหมดแล้ว" → mark all read (optimistic).
- Unread count refreshes on page focus and every 60 s while the app is open (no push in phase 1).
- Validation: none.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Follows the layout at 375px and 1280px using the option-a notification row look
- [ ] Every message template renders with the exact copy and icon (one mock per event)
- [ ] Unread styling is not color-only (weight + dot + sr-only text)
- [ ] Bell badge shows count / 9+ / hidden; bottom-nav dot
- [ ] Empty, error, loading states
- [ ] Uses only design-system tokens and shadcn components
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
