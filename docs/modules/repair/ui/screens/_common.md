# Common UI rules — ระบบแจ้งซ่อม

Status: APPROVED (2026-10-14)

> **CR-009 (approved 2026-10-18):** wording — ขั้นตอน (CR-009): แจ้งงาน → **รับเรื่อง** (ทันทีที่ส่ง, `awaiting_assessment`) → **กำลังดำเนินการ** (`in_repair`) → **ส่งกลับให้แก้** (`reworking`, เฉพาะเมื่อถูกส่งกลับ) → **เสร็จ · รอประเมินตรวจงาน** (`awaiting_rating`; ผู้แจ้งเห็น `รอคุณประเมินตรวจงาน`) → **ปิดงานแล้ว** (`closed`). ปุ่มช่าง `เริ่มดำเนินการ` (กำหนดวันเสร็จ + ใครซ่อม) · ปุ่มผู้แจ้ง `ประเมินตรวจงาน` (ดาว 1–5). Supersedes the CR-008 wording line below (D-060).


> **CR-008 (approved 2026-10-16):** visual style = `docs/shared/design-system.md` (rewritten by CR-008: demo.css look, Anuphan only, no gradient headers). Sample buildings renamed (ids unchanged): อาคารหลัก → **อาคารฝั่ง Office** (7 floors) · อาคารด้านหลัง → **อาคาร Office โรงงานบางซ่อน** (2 floors). Sample symptom priorities — ระบบปรับอากาศ: แอร์ไม่เย็น ปกติ · มีน้ำหยด สูง · มีเสียงดัง ปกติ · มีกลิ่นอับ ต่ำ · เปิดไม่ติด สูง · ไฟฟ้าและแสงสว่าง (default สูง): ไฟไม่ติด ปกติ · ไฟกะพริบ ต่ำ · ปลั๊กไม่มีไฟ ปกติ · เบรกเกอร์ตัด ฉุกเฉิน · ประปาและสุขภัณฑ์: น้ำรั่ว สูง · ท่อตัน ปกติ · ชักโครกกดไม่ลง ปกติ · น้ำไม่ไหล สูง · อาคารและเฟอร์นิเจอร์ (default ต่ำ): ประตูปิดไม่สนิท ต่ำ · กระเบื้องแตก ปกติ · เก้าอี้ชำรุด ต่ำ · ฝ้าเพดานรั่ว สูง · ความสะอาด: พื้นเปียก สูง · ขยะล้น ปกติ · มีกลิ่นไม่พึงประสงค์ ต่ำ (other defaults ปกติ). Wording: technician "รับเรื่อง", reporter "ให้คะแนน", "ช่างของบริษัท".


<!-- Written by Claude in /ui-spec (2026-10-14). Every screen spec (S01–S16) refers to this file.
     Rules here apply to all screens unless a spec says otherwise. Tokens and components: docs/shared/design-system.md -->

## 1. App shell per role

> **CR-010 (approved 2026-10-18) — replaces the bottom nav, the sidebar, the desktop top bar utilities and the role switcher placement below (D-064).**
> - **Top navbar (`AppNavbar`, every role, every page):** BAMBAM logo (→ `/`) · หน้าแรก · แจ้งซ่อม · จองรถ · จองห้องประชุม (same size, icon and padding; only the current one is active) · bell (→ `/notifications`) · account (avatar; desktop adds name + role label) → menu `โปรไฟล์` (`/profile`) · `ออกจากระบบ` (S14 confirm). No repair CTA, no mascot. Desktop (≥ `lg`): floating white bar, sticky 12px from the top, max 1280px. Phone / tablet: brand row + a full-width row of the three services; scrolls away so page sticky bars (back bar, form actions) keep the top / bottom edge. (CR-010)
> - **Service links:** แจ้งซ่อม → `/repair/my` (technician `/repair/work`), active on every `/repair/*` route · จองรถ → `/car-booking` · จองห้องประชุม → `/room-booking`; both show "เร็วๆ นี้" pages (no booking form) until their modules exist. (CR-010)
> - **Repair section nav (`RepairNav`):** on the repair list pages, for roles with staff tools only — technician: ติดตามงานซ่อม · งานซ่อม · ช่างภายนอก; admin / executive: ติดตามงานซ่อม · งานทั้งหมด · ช่างภายนอก · ภาพรวมอาคาร (same links as the old sidebar). Employees and leads reach แจ้งซ่อมใหม่ from S06. (CR-010)
> - **No bottom nav, no sidebar.** The สแกน shortcut returns with Stage 5 inside the repair screens. (CR-010)
> - **Role switcher (dev / UAT only):** one 28px amber strip above the navbar on every width: `{ENV} · กำลังดูในบทบาท: {role} · เปลี่ยน` (sheet on phones, popover on desktop). (CR-010)
> - **Page headers:** keep the mobile header variants below, but none of them carries the bell or the role switcher any more; desktop shows the H1 title (+ search / action). (CR-010)

Layouts switch at `lg` (1024px) — mobile app layout below, desktop web layout from it (D-008).

**Mobile bottom nav (`BottomNav`) — same for every role:**
หน้าแรก (`/`) · ติดตามงาน (`/repair/my`, CR-003) · **สแกน** (`/repair/scan`, raised center button) · แจ้งเตือน (`/notifications`, red dot when unread) · โปรไฟล์ (`/profile`)

Shown on: S02, S06, S09, S13, S14. Hidden on sub-pages and full-screen flows: S03, S05, S07, S10, S11, S12, S16.

**Desktop sidebar (shadcn `Sidebar`):**

| Group | Item | Route | Roles |
|---|---|---|---|
| — | หน้าแรก | `/` | all |
| — | ติดตามงานซ่อม `n` (CR-003) | `/repair/my` | all (count = open tickets I reported or follow) |
| — | แจ้งเตือน `n` | `/notifications` | all (count = unread) |
| บริการ | แจ้งซ่อม | `/repair/new` | all |
| บริการ | จองรถ · chip "เร็วๆ นี้" | — (disabled) | all |
| บริการ | จองห้องประชุม · chip "เร็วๆ นี้" | — (disabled) | all |
| งานช่าง | คิวงาน `n` | `/repair/queue` | technician (count = queue items visible to me) |
| จัดการงานซ่อม | คิวงาน | `/repair/admin/queue` | admin, executive |
| จัดการงานซ่อม | ภาพรวมอาคาร | `/repair/admin/overview` | admin, executive |
| bottom | user card (avatar, name, role label) → `/profile`; logout icon → logout confirm (S14) | | all |

**Desktop top bar:** page title (H1) · search pill "ค้นหาเลขงาน หรือสถานที่" (only on S06, S11) · `RoleSwitcher` (dev/UAT) · bell with count.

**Mobile page headers — which one each screen uses:**

| Header | Screens |
|---|---|
| `bg-brand` hero (greeting, bell, role switcher pill) | S02 |
| `bg-brand` short header (title + one action) | S13, S14 |
| `ServiceHeader` repair (orange, curved bottom, wrench icon circle) | S06, S09 |
| White top bar: back · centered title · optional right action (`paotang-09`) | S03, S07, S10, S11 (mobile), S12 (mobile) |
| Full screen, no header | S01, S05, S16 |

**Role switcher (dev/UAT only):** pages with a gradient header (`bg-brand` or `ServiceHeader`) show the translucent pill inside the header; mobile pages with a white top bar or full screen show a 28px amber strip above everything: `UAT · กำลังดูในบทบาท: {role label} · เปลี่ยน`; desktop shows the amber pill in the top bar. Details in S15.

**Pickers (CR-002):** wherever a screen spec says `Select`, build it as `Picker` (form field) or `FilterPill` (filter) from `components/shared`, following design-system.md → Patterns → Pickers. Never use `components/ui/select` directly.

## 2. Labels (use exactly)

**Status** (`Badge` with dot, `bg-status-*/10 text-status-*`):

| `status` | Label | Icon in list circle (lucide) |
|---|---|---|
| `new` | รอช่างรับงาน | `Hourglass` |
| `in_progress` | ช่างกำลังดำเนินการ | `Wrench` |
| `resolved` | ซ่อมเสร็จ รอตรวจรับ | `ClipboardCheck` |
| `closed` | ปิดงานแล้ว | `CircleCheck` |

**Extra badges** (no dot unless noted):

| When | Label | Style |
|---|---|---|
| `resolved` and viewer is the reporter | รอคุณตรวจรับ | solid `bg-status-resolved text-white`; card tinted `bg-status-resolved/5 border-status-resolved/15` |
| viewer is a subscriber | คุณติดตามเคสนี้ | muted, `Bookmark` icon 14px |
| `new` reserved for the viewing technician (BR-F07-3) | ส่งกลับให้แก้ · งานถัดไปของคุณ | `bg-status-resolved/10 text-status-resolved` |
| `new` reserved for another technician (admin views) | จองให้ช่าง{ชื่อ} | muted |
| admin moved this queue item (BR-F22-2) | จัดลำดับเอง | muted, tooltip "เลื่อนโดย {ชื่อ} {วันเวลา}" |

**Closed reason** (caption next to the closed badge): `confirmed` ตรวจรับแล้ว · `auto_closed` ปิดอัตโนมัติ · `team_handled` ทีมดำเนินการเอง · `admin_closed` Admin ปิดงาน

**Priority** (`PriorityIndicator`): `critical` ฉุกเฉิน · `high` สูง · `medium` ปกติ · `low` ต่ำ

**Roles:** `employee` พนักงานทั่วไป · `housekeeper_lead` หัวหน้าแม่บ้าน · `security_lead` หัวหน้ารปภ. · `technician` ช่างเทคนิค · `admin` Admin · `executive` ผู้บริหาร

## 3. Ticket display rules

- **Title** = the symptom names joined with ` · `, e.g. `แอร์ไม่เย็น · มีน้ำหยด`. Tickets have no free-text title. Truncate to one line in lists; wrap in detail.
- **Location line** = `{อาคาร} ชั้น {ชั้น}` + ` · {จุดที่เกิด}` when filled, e.g. `อาคารหลัก ชั้น 5 · ห้องประชุม 5B`.
- **Ticket number** = `ticket_no` as stored (`RP-2569-000142`), Prompt 600 12.5px, letter-spacing .02em. Never rebuild it in the UI (BR-F02-5).
- **Dates** (Asia/Bangkok, Thai short month, BE year, 24h):
  - detail and timeline: `14 ต.ค. 2569 10:15`
  - lists: today → `10:15`; yesterday → `เมื่อวาน 16:48`; this year → `13 ต.ค. 16:48`; older → `2 ก.ย. 2568`
  - long date in greetings: `พุธ 14 ต.ค. 2569`
- **People:** technician shown as `ช่าง{ชื่อ}` in short text (`ช่างธนากร`), full name in detail. Reporter shown as full name + department.

## 4. List row anatomy (mobile)

One white `Card` holding rows separated by `border` lines (`paotang-06`). Row ≥ 64px:

```
┌──────────────────────────────────────────┐
│ (●icon)  แอร์ไม่เย็น · มีน้ำหยด            › │  ← 40px status icon circle · title H3 one line
│          อาคารหลัก ชั้น 5 · ห้องประชุม 5B     │  ← Small, muted
│          [● ช่างกำลังดำเนินการ]  ช่างธนากร · 09:20 │  ← badge + caption meta
└──────────────────────────────────────────┘
```

Whole row is the link (≥ 44px). Items that wait for the viewer go above the list in their own highlighted card (design-system "Lists").

Desktop lists use `Table` inside a `Card` (header row `bg-muted`, rows 60–64px, title column wraps with meta under it).

S06 uses a richer row: 56px photo thumb + title + location + mini progress (S06 spec "Progress tracker") (CR-002).

## 5. Photo picker (`PhotoPicker`, module component — used by S03, S08, S10)

```
┌──────┐┌──────┐┌──────┐
│ img ✕││ ◔ 60%││ ┌──┐ │   3 columns, square tiles, radius 16px
│      ││      ││ │📷│ │   add tile: dashed `border-input`, Camera icon, "เพิ่มรูป", counter "2/5"
└──────┘└──────┘└──────┘
```

- Picking opens the OS chooser (camera or gallery): `<input type="file" accept="image/*" multiple>`. No `capture` attribute, so the user can choose either.
- Upload starts right after picking, so submit is quick. Tile states:
  - uploading: thumbnail dimmed + progress ring
  - done: thumbnail + remove button (✕, 32px hit area, aria-label "ลบรูป")
  - failed: red overlay, `AlertCircle` + "ลองใหม่" (tap retries)
- Resize on the client before upload (long edge 1920px, JPEG) — proposal, confirm in `/stage-plan`.
- Max 5 photos; the add tile hides at 5/5. Tapping a done tile opens the lightbox.
- Messages:

| Case | Message |
|---|---|
| picked more than the remaining slots | toast: แนบได้สูงสุด 5 รูป |
| not an image | under the picker: รองรับเฉพาะไฟล์รูปภาพ |
| file too large (proposed 10 MB before resize) | under the picker: รูปนี้ใหญ่เกิน 10 MB |
| upload failed | on the tile: ลองใหม่ |
| submit while uploading | under the picker: รอให้รูปอัปโหลดเสร็จก่อน |
| submit with a failed tile | under the picker: มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น |

## 6. Shared state copy

| State | Copy | Pattern (design-system "Patterns") |
|---|---|---|
| Whole page failed | title: โหลดข้อมูลไม่สำเร็จ · hint: ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button: ลองอีกครั้ง | mascot + retry |
| Part of page failed | per screen (title) + hint: ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง · button: ลองอีกครั้ง | inline `Alert` destructive + full-width outline button |
| Forbidden | title: คุณไม่มีสิทธิ์เข้าหน้านี้ · reason per screen · button: กลับหน้าแรก | mascot `bust` |
| Ticket not found | title: ไม่พบงานนี้ · hint: ตรวจสอบเลขงานอีกครั้ง · button: กลับหน้าแรก | mascot `bust` |
| Action failed (unknown / network) | toast: ทำรายการไม่สำเร็จ ลองอีกครั้ง | toast error |
| Search with no result | title: ไม่พบงานที่ตรงกับ "{q}" · button: ล้างการค้นหา | small empty card, no mascot |
| Session expired | handled by `proxy.ts` → S01 with `?reason=expired`, then back to the same page | — |

Error codes and their HTTP status are fixed in `../../04-api-contract.md` (written in `/stage-plan`). Each spec lists the user-facing message for every expected error; the contract maps codes to these messages.

## 7. Dialogs used on several screens

All use `AlertDialog` (destructive or irreversible) or `Dialog`, become a bottom `Sheet` on mobile, and keep the reason text if the request fails.

| Dialog | Used on | Title | Body | Field | Buttons |
|---|---|---|---|---|---|
| Give back (คืนงาน, F21) | S07, S09, S10 | คืนงานเข้าคิว? | งานจะกลับไปที่ตำแหน่งเดิมในคิว ให้ช่างคนอื่นรับต่อได้ | เหตุผลที่คืนงาน * (Textarea, max 500) — error: กรุณาใส่เหตุผล | ยกเลิก · **คืนงาน** |
| Hand over (ส่งต่อให้ช่าง, F05) | S07, S11 | ส่งต่องานนี้ให้ช่าง? | งานเดิม เลขเดิม จะกลับเข้าคิวช่างหมวด{หมวด} ตามความเร่งด่วน | เหตุผลที่ส่งต่อ * (Textarea, max 500, placeholder "เช่น ทีมเช็ดแล้วแต่ยังมีน้ำซึมจากฝ้า") — error: กรุณาใส่เหตุผล | ยกเลิก · **ส่งต่อให้ช่าง** |
| Close ticket (ปิดงาน, F08-B) | S07, S11 | ปิดงาน {ticket_no}? | งานจะปิดทันทีโดยไม่ต้องรอตรวจรับ ผู้แจ้ง ผู้ติดตาม และช่างที่ถืองานจะได้รับแจ้งเตือน | เหตุผลที่ปิดงาน * (Textarea, max 500) — error: กรุณาใส่เหตุผล | ยกเลิก · **ปิดงาน** (destructive) |
| Change priority (F22) | S07, S11 | เปลี่ยนความเร่งด่วนเป็น "{ระดับ}"? | ถ้างานนี้ถูกเลื่อนลำดับไว้ จะกลับไปเรียงตามความเร่งด่วนอัตโนมัติ | — | ยกเลิก · **เปลี่ยน** |
| Claim (รับงาน, F21) | S07, S09 | รับงานนี้? | {title} · {location} — คุณถืองานได้ทีละ 1 งาน ต้องบันทึกผลหรือคืนงานก่อนรับงานใหม่ | — | ยกเลิก · **รับงาน** |
| Discard form | S03, S10 | ทิ้งข้อมูลที่กรอกไว้? | ข้อมูลและรูปที่แนบในหน้านี้จะหายไป | — | กรอกต่อ · **ทิ้งข้อมูล** (destructive) |

Success toasts: คืนงานแล้ว · ส่งต่อให้ช่างแล้ว · ปิดงานแล้ว · เปลี่ยนความเร่งด่วนแล้ว · รับงานแล้ว

## 8. Sample data (mockups and `mocks.ts`)

Sample only — replace when the seed files arrive (`../../02-flows.md` Open questions). Names are fictional.

- **Buildings / floors:** อาคารหลัก ชั้น 1–7 · อาคารด้านหลัง ชั้น 1–2
- **Categories → symptoms:**
  - ระบบปรับอากาศ → แอร์ไม่เย็น, มีน้ำหยด, มีเสียงดัง, มีกลิ่นอับ, เปิดไม่ติด
  - ไฟฟ้าและแสงสว่าง → ไฟไม่ติด, ไฟกะพริบ, ปลั๊กไม่มีไฟ, เบรกเกอร์ตัด
  - ประปาและสุขภัณฑ์ → น้ำรั่ว, ท่อตัน, ชักโครกกดไม่ลง, น้ำไม่ไหล
  - อาคารและเฟอร์นิเจอร์ → ประตูปิดไม่สนิท, กระเบื้องแตก, เก้าอี้ชำรุด, ฝ้าเพดานรั่ว
  - ความสะอาด → พื้นเปียก, ขยะล้น, มีกลิ่นไม่พึงประสงค์
- **People:**

| Role | Name | Department / scope |
|---|---|---|
| employee | วรรณา สุขประเสริฐ | ฝ่ายบัญชี |
| employee | กิตติพัฒน์ แสงทอง | ฝ่ายจัดซื้อ |
| housekeeper_lead | มาลี ทองดี | ฝ่ายอาคารสถานที่ |
| security_lead | สมศักดิ์ แก้วกล้า | ฝ่ายอาคารสถานที่ |
| technician | ธนากร พึ่งบุญ | ระบบปรับอากาศ, ไฟฟ้าและแสงสว่าง |
| technician | วีระ มั่นคง | ประปาและสุขภัณฑ์ |
| technician | สุริยา ทองมา | ไฟฟ้าและแสงสว่าง |
| technician | อนุชา ใจกล้า | อาคารและเฟอร์นิเจอร์ |
| admin | ปวีณา ศรีสุข | ศูนย์จัดการงานอาคาร |
| executive | ประเสริฐ วงศ์ไทย | ผู้อำนวยการฝ่ายอาคารสถานที่ |

- **Asset (QR):** `AC-05-012` เครื่องปรับอากาศ ห้องประชุม 5B → ระบบปรับอากาศ · อาคารหลัก ชั้น 5 · ห้องประชุม 5B
- **Tickets:** `RP-2569-000135` … `RP-2569-000150`, see the mockups for the full set.

## Open questions (UI-level, none blocks the specs)

- Photo limits: max file size before resize (proposed 10 MB) and client-side resize (proposed 1920px JPEG) — confirm in `/stage-plan`.
- How a tester leaves role-switch mode and returns to their own account (proposed: ออกจากระบบ แล้วเข้าใหม่) — S15.
