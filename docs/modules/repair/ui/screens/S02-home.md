# S02 — หน้าแรก

Status: APPROVED (2026-10-14)

- **Flows:** F01 step 3 (land on Home by role), F06 (my open tickets, BR-F06-2), F21 (technician: current job + queue), F22/F23 entry for admin and executive (see ../../02-flows.md)
- **Persona:** employee, housekeeper_lead, security_lead, technician on mobile; admin, executive on desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** show each role the one thing to do next — report a problem, confirm a repair, work the queue, or watch the backlog.
- **Route:** `/` (`app/(app)/page.tsx`) — platform route that renders repair widgets from `modules/repair/components`
- **Mockup:** employee variant = `docs/shared/style/options/option-a.html` (approved, mobile + desktop + empty + error). Technician variant → closest `../mockups/S09-technician-queue.html` (pinned job card + queue rows). Admin variant → closest `../mockups/S11-admin-queue.html` (desktop cards and table).
- **Data:** current user (`GET /api/v1/me`) + repair home summary (my open tickets, awaiting-my-confirmation, technician current/reserved job + first 3 queue items, admin counts by status) → `modules/repair/api.ts` (names fixed in 04-api-contract.md)

The page has three variants chosen by role. Header, services row and bottom nav are the same for all.

## Layout — mobile first

### A. employee / housekeeper_lead / security_lead (exactly as option-a.html)

```
┌────────────────────────────┐
│ bg-brand hero               │
│ [UAT · ดูในบทบาท: … ▾]       │ ← RoleSwitcher pill (dev/UAT only)
│ (วร) สวัสดี คุณวรรณา   [🔔2] │
│      ฝ่ายบัญชี · พุธ 14 ต.ค. 2569
│┌──────────────────────────┐│ ← CTA card overlaps hero 54px, mascot bust peeks above it
││ เจออะไรเสีย บอก BAMBAM    ││
││ ถ่ายรูป เลือกอาการ ส่งถึง… ││
││ [🔧 แจ้งซ่อม (brand)][QR สแกน QR]│
│└──────────────────────────┘│
│ บริการ                       │
│ [แจ้งซ่อม][จองรถ เร็วๆนี้][จองห้อง เร็วๆนี้] │
│ งานของฉัน          ดูทั้งหมด › │
│┌ รอคุณตรวจรับ  ปิดอัตโนมัติ 17 ต.ค.…┐│ ← one tinted card per ticket awaiting me (max 2, newest first)
││ แอร์ไม่เย็น · มีน้ำหยด        ││
││ 📍 อาคารหลัก ชั้น 5 · ห้องประชุม 5B ││
││ 🕘 RP-2569-000142 · ช่างบันทึกผล 10:15 ││
││ [ส่งกลับให้แก้] [✓ ตรวจรับงาน] ││
│└──────────────────────────┘│
│┌ list card: up to 3 other open tickets ┐│
│└──────────────────────────┘│
├────────────────────────────┤
│ BottomNav                   │
└────────────────────────────┘
```

### B. technician

```
┌────────────────────────────┐
│ bg-brand hero: (ธน) สวัสดี ช่างธนากร [🔔] │
│      ช่างเทคนิค · ระบบปรับอากาศ, ไฟฟ้าฯ │
│┌──────────────────────────┐│ ← overlapping card = current job (one of 4 states below)
││ [● งานที่กำลังทำ]  รับงาน 09:20 ││
││ ไฟกะพริบ · ไฟไม่ติด          ││
││ 📍 อาคารหลัก ชั้น 3 · หน้าลิฟต์ ││
││ [คืนงาน]  [บันทึกผลซ่อม]     ││
│└──────────────────────────┘│
│ คิวงานหมวดของคุณ    ดูทั้งหมด 12 › │
│┌ list card: first 3 queue items, queue order ┐│
││ 1 ▮▮▮ฉุกเฉิน น้ำรั่ว · อาคารหลัก ชั้น 2  › ││
││ 2 ▮▮▮สูง  ไฟไม่ติด · อาคารด้านหลัง ชั้น 1 › ││
││ 3 ▮▮ ปกติ แอร์ไม่เย็น · อาคารหลัก ชั้น 6  › ││
│└──────────────────────────┘│
│ บริการ (same as A)            │
│ งานที่ฉันแจ้ง (same block as A "งานของฉัน", hidden when none) │
├────────────────────────────┤
│ BottomNav                   │
└────────────────────────────┘
```

Current-job card states (same rules as S09 pinned card):

| State | Card content |
|---|---|
| Holding an `in_progress` ticket | badge "งานที่กำลังทำ" (status-in-progress) · title · location · `รับงาน {time}` · buttons "คืนงาน" (outline sm) + "บันทึกผลซ่อม" (default sm) |
| Reserved (sent back) and not holding | badge "ส่งกลับให้แก้ · งานถัดไปของคุณ" · title · location · reason excerpt (2 lines) · button "เริ่มงาน" (default sm) |
| Holding and reserved | holding card as above + one line under it: "มีงานส่งกลับให้แก้รออยู่ 1 งาน — เริ่มได้หลังจบงานนี้" |
| Neither | mascot face 56px + "ยังไม่มีงานที่ถืออยู่" + hint "เลือกงานจากคิว แล้วกด รับงาน" + button "ดูคิวงาน" (default sm) |

Queue rows here have no claim button — tap opens S07 (claim is done there or on S09).

### C. admin / executive (mobile is usable but secondary)

```
┌────────────────────────────┐
│ bg-brand hero: (ปว) สวัสดี คุณปวีณา [🔔] │
│      Admin · ศูนย์จัดการงานอาคาร        │
│┌──────────────────────────┐│ ← overlapping card: 2×2 counts, each a link
││ รอช่างรับงาน 14 │ กำลังดำเนินการ 6 ││
││ รอตรวจรับ 3    │ ฉุกเฉินที่ยังไม่ปิด 1 ││
││ [เปิดคิวงาน]               ││
│└──────────────────────────┘│
│ ภาพรวมอาคาร › (row link; S12 shows the floor list on mobile) │
│ บริการ · งานของฉัน (same as A)        │
└────────────────────────────┘
```

Desktop (≥1024px):

- **A (employee / leads):** exactly option-a.html desktop — sidebar, top bar, `bg-brand` banner with mascot `full` ("สวัสดี คุณวรรณา" + "คุณมี 1 งานรอตรวจรับ และอีก 2 งานกำลังดำเนินการ" + white "แจ้งซ่อม" + glass "ดูงานของฉัน"), 3 service cards, then grid `1fr 282px`: "งานของฉันที่ยังไม่ปิด" table card (pill tabs ทั้งหมด / รอตรวจรับ / กำลังดำเนินการ with counts) + "แจ้งเตือนล่าสุด" card (5 latest).
- **B (technician):** banner text "วันนี้มี 12 งานในคิวหมวดของคุณ" + white "ดูคิวงาน" + glass "แจ้งซ่อม"; under it grid `1fr 320px`: left "คิวงานหมวดของคุณ" table (first 5 rows, same columns as S09 desktop, without claim buttons) · right current-job card (states above) + "แจ้งเตือนล่าสุด".
- **C (admin / executive):** banner text "วันนี้มี 14 งานรอช่างรับ · ฉุกเฉิน 1 งาน" + white "เปิดคิวงาน" + glass "ภาพรวมอาคาร"; row of 4 stat cards (same 4 counts, each links to the S11 tab — "ฉุกเฉินที่ยังไม่ปิด" links to S11 tab รอช่างรับ… with priority filter ฉุกเฉิน); grid `1fr 282px`: "งานฉุกเฉินและสูงที่รอช่างรับ" table (top 5 by queue order: เลขงาน · เรื่อง / สถานที่ · หมวดงาน · ความเร่งด่วน · แจ้งเมื่อ · ›) + "แจ้งเตือนล่าสุด".

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Hero (mobile) | `bg-brand` header + avatar initials + bell (`bellbtn`) + `RoleSwitcher` pill | as option-a.html |
| Banner (desktop) | `bg-brand` banner radius-2xl + `Mascot` full | |
| CTA card | `Card` + `Mascot` bust + `Button` variant `brand` ("แจ้งซ่อม") + `Button` outline ("สแกน QR") | the only `brand` button on the page |
| Services | `ServiceIcon` ×3 (repair active; car / room disabled + chip "เร็วๆ นี้") | |
| Awaiting card | tinted card + solid badge "รอคุณตรวจรับ" + 2 small buttons | design-system "รอคุณตรวจรับ" row |
| Ticket list | list card (mobile) / `Table` in `Card` (desktop) | `_common.md` §4 |
| Current job card (tech) | `Card` `shadow-float` + status badge + buttons | |
| Queue rows (tech) | list rows with order number + `PriorityIndicator` | |
| Stat cards (admin) | `Card` with number (Prompt 600 28px) + label + `›` | number colored by status token |
| Notifications preview | notification rows (S13 anatomy) | desktop only |
| Bottom nav | `BottomNav` (Home active) | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Greeting | สวัสดี คุณ{ชื่อ} · technician: สวัสดี ช่าง{ชื่อ} |
| Greeting sub-line | {ฝ่าย} · {วันแบบยาว} — technician: ช่างเทคนิค · {หมวดงาน, คั่นด้วย ", "} — admin/executive: {role label} · {ฝ่าย} |
| CTA title / body | เจออะไรเสีย บอก BAMBAM / ถ่ายรูป เลือกอาการ ส่งถึงช่างในหมวดนั้นทันที |
| CTA buttons | แจ้งซ่อม · สแกน QR |
| Services section | บริการ · tile captions: แจ้งซ่อม "{n} งานยังไม่ปิด" (or "แจ้งปัญหา ติดตามงาน" when 0) · จองรถ / จองห้องประชุม chip "เร็วๆ นี้" |
| My tickets section | งานของฉัน · link ดูทั้งหมด (technician: งานที่ฉันแจ้ง) |
| Awaiting card | badge รอคุณตรวจรับ · caption ปิดอัตโนมัติ {d MMM} หากไม่ตรวจรับ · meta `{ticket_no} · ช่างบันทึกผล {time}` · buttons ส่งกลับให้แก้ / ตรวจรับงาน |
| Row meta (examples) | `ช่างธนากร · 09:20` · `คุณติดตามเคสนี้ · 13 ต.ค. 16:48` · `แจ้งเมื่อ 08:52` |
| Technician queue section | คิวงานหมวดของคุณ · link ดูทั้งหมด {n} |
| Technician card | งานที่กำลังทำ · รับงาน {time} · คืนงาน · บันทึกผลซ่อม · ส่งกลับให้แก้ · งานถัดไปของคุณ · เริ่มงาน · มีงานส่งกลับให้แก้รออยู่ 1 งาน — เริ่มได้หลังจบงานนี้ · ยังไม่มีงานที่ถืออยู่ · เลือกงานจากคิว แล้วกด รับงาน · ดูคิวงาน |
| Admin counts | รอช่างรับงาน · กำลังดำเนินการ · รอตรวจรับ · ฉุกเฉินที่ยังไม่ปิด · button เปิดคิวงาน · row ภาพรวมอาคาร |
| Desktop banner text | A: คุณมี {n} งานรอตรวจรับ และอีก {m} งานกำลังดำเนินการ (when both 0: เจออะไรเสีย ถ่ายรูปแล้วแจ้ง BAMBAM ได้เลย) · B: วันนี้มี {n} งานในคิวหมวดของคุณ · C: วันนี้มี {n} งานรอช่างรับ · ฉุกเฉิน {m} งาน (omit the second part when m = 0) |
| Desktop banner buttons | A: แจ้งซ่อม / ดูงานของฉัน · B: ดูคิวงาน / แจ้งซ่อม · C: เปิดคิวงาน / ภาพรวมอาคาร |
| Desktop cards | งานของฉันที่ยังไม่ปิด · แจ้งเตือนล่าสุด (link ทั้งหมด) · งานฉุกเฉินและสูงที่รอช่างรับ |
| Empty — my tickets | ยังไม่มีงานที่คุณแจ้ง / เจออะไรเสีย ถ่ายรูปแล้วแจ้ง BAMBAM ได้เลย หรือสแกน QR ที่ติดบนอุปกรณ์ / button แจ้งซ่อม |
| Empty — technician queue | ยังไม่มีงานในหมวดของคุณ / งานใหม่จะแจ้งเตือนที่กระดิ่ง |
| Technician without categories | ยังไม่ได้กำหนดหมวดงาน ติดต่อ Admin |
| Empty — admin urgent table | ไม่มีงานฉุกเฉินหรือสูงที่รอช่างรับ |
| Error — my tickets block | Alert: โหลดงานของคุณไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง ยังแจ้งซ่อมใหม่ได้ตามปกติ · button ลองอีกครั้ง |
| Error — queue block | Alert: โหลดคิวงานไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button ลองอีกครั้ง |
| Error — counts block | Alert: โหลดสรุปงานไม่สำเร็จ / ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button ลองอีกครั้ง |

## States

| State | What shows |
|---|---|
| Loading | Skeleton: hero block, CTA/current-job card, 3 service tiles, 3 list rows. Header greeting renders as soon as `/me` returns. |
| Empty | Per block (copy above). The rest of the page stays normal. |
| Error | Per block: inline Alert + full-width "ลองอีกครั้ง"; CTA and services stay usable. `/me` failing = whole-page error (`_common.md` §6). |
| Forbidden | — (every logged-in role can open Home). |
| Success feedback | — |

## Interactions

- "แจ้งซ่อม" → S03 `/repair/new`. "สแกน QR" → S16 `/repair/scan`.
- Service tile แจ้งซ่อม → S06 `/repair/my`. Disabled tiles do nothing (`aria-disabled`, chip "เร็วๆ นี้").
- Awaiting card: "ตรวจรับงาน" → S07 `/repair/tickets/{id}?action=confirm` (opens S08 confirm); "ส่งกลับให้แก้" → `?action=sendback`; tapping the card body → S07.
- Technician: "บันทึกผลซ่อม" → S10; "คืนงาน" → give-back dialog (`_common.md` §7), stays on Home and refreshes; "เริ่มงาน" → starts the reserved ticket (no confirm), toast "เริ่มงานแล้ว", card switches to holding; "ดูคิวงาน" / "ดูทั้งหมด" → S09.
- Admin counts → S11 with the matching tab (`?tab=new|in_progress|resolved`, urgent → `?tab=new&priority=critical`). "ภาพรวมอาคาร" → S12.
- Bell → S13. Avatar → S14.
- Data refreshes when the tab regains focus.
- Validation: none.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Variant A matches option-a.html at 375px and 1280px (incl. empty and error frames)
- [ ] Variants B and C follow the layouts above and the closest mockups (S09, S11)
- [ ] Only one `brand` button on screen
- [ ] Awaiting cards appear above other tickets (BR-F06-2), max 2, then the list
- [ ] All four technician card states render with the exact copy
- [ ] Every block has its own loading / empty / error state; one failing block does not hide the others
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (labels, focus order, disabled tiles announced)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`) for all 6 roles via the role switcher
