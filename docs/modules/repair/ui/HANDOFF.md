# UI handoff — ระบบแจ้งซ่อม — Stage <n>

Status: NOT READY — specs only (Claude sets `READY FOR CODEX — Stage <n>` in /build-stage prepare; Codex sets `UI DONE — Stage <n>, waiting for Claude wire`)

<!-- Written by Claude (/ui-spec 2026-10-14, updated by /build-stage prepare). Codex starts here.
     The Stage column is filled by /stage-plan. Only build the screens of the current stage. -->

## Read in this order

1. `frontend/AGENTS.md` (rules)
2. `docs/shared/design-system.md` (tokens, components, patterns)
3. `ui/screens/_common.md` (app shell per role, labels, list rows, PhotoPicker, shared dialogs and state copy) — applies to every screen
4. Screen specs for this stage (below)
5. Mockups next to them (open the .html in a browser; phone frames scroll)
6. `frontend/src/modules/repair/types.ts` and `mocks.ts` (data shapes — do not change)

## Screens

| Screen | Spec | Mockup (closest if none) | Route | Stage |
|---|---|---|---|---|
| S01 เข้าสู่ระบบ / ออกจากระบบแล้ว | `screens/S01-login.md` | — (`docs/shared/style/options/option-a.html`) | `/login`, `/signed-out` | 0 (platform) |
| S02 หน้าแรก | `screens/S02-home.md` | `docs/shared/style/options/option-a.html` (employee); `mockups/S09-technician-queue.html` (technician); `mockups/S11-admin-queue.html` (admin) | `/` | 7 (Stage 0: placeholder) |
| S03 ฟอร์มแจ้งซ่อม | `screens/S03-report-form.md` | `mockups/S03-report-form.html` | `/repair/new` | 1 (+5 team card, +6 QR banner) |
| S04 พบงานซ้ำ | `screens/S04-duplicate-found.md` | `mockups/S03-report-form.html` → "พบงานซ้ำ" | — (sheet / dialog) | 5 |
| S05 แจ้งสำเร็จ | `screens/S05-report-success.md` | `mockups/S03-report-form.html` → S05 frames | `/repair/new/done` | 1 (+5 team variant) |
| S06 งานของฉัน | `screens/S06-my-tickets.md` | — (`option-a.html` list + `mockups/S09-technician-queue.html` header) | `/repair/my` | 1 |
| S07 รายละเอียดงาน | `screens/S07-ticket-detail.md` | `mockups/S07-ticket-detail.html` | `/repair/tickets/[id]` | 1 view (+2, 3, 4, 5 actions) |
| S08 ตรวจรับ / ส่งกลับให้แก้ | `screens/S08-confirm-or-send-back.md` | `mockups/S07-ticket-detail.html` → S08 frames | — (sheet / dialog) | 3 |
| S09 คิวงานช่าง | `screens/S09-technician-queue.md` | `mockups/S09-technician-queue.html` | `/repair/queue` | 2 (+3 reserved states) |
| S10 บันทึกผลซ่อม | `screens/S10-record-result.md` | — (`mockups/S03-report-form.html` form + `mockups/S07-ticket-detail.html` header) | `/repair/tickets/[id]/resolve` | 2 |
| S11 คิวงาน (Admin) | `screens/S11-admin-queue.md` | `mockups/S11-admin-queue.html` | `/repair/admin/queue` | 4 (+5 hand over) |
| S12 ภาพรวมอาคาร 3D | `screens/S12-building-overview.md` | `mockups/S12-building-overview.html` | `/repair/admin/overview` | 8 |
| S13 แจ้งเตือน | `screens/S13-notifications.md` | — (`option-a.html` notification rows) | `/notifications` | 7 |
| S14 โปรไฟล์ | `screens/S14-profile.md` | — (`option-a.html`) | `/profile` | 0 (platform) |
| S15 ตัวสลับบทบาท | `screens/S15-role-switcher.md` | — (pill in `option-a.html`) | — (component) | 0 (platform) |
| S16 สแกน QR | `screens/S16-scan-qr.md` | — (`mockups/S03-report-form.html`) | `/repair/scan` | 6 |

**Shared / platform screens:** S01, S02, S13, S14 and S15 live outside `app/(app)/repair` (routes `/login`, `/signed-out`, `/`, `/notifications`, `/profile`, and `components/shared/RoleSwitcher`). S01, S14, S15 and the AppShell are built in Stage 0 (`docs/shared/00-platform.md`); S02 and S13 in repair Stage 7, when "You may edit" is widened to `app/(app)/page.tsx` and `app/(app)/notifications/**` for that stage only.

## You may edit

- `frontend/src/app/(app)/repair/**`
- `frontend/src/modules/repair/components/**`
- `frontend/src/components/ui/**` only via `npx shadcn@latest add`
- This file: checklist and "Open questions" only

## Do not edit

- `backend/**`, `docs/**` (except this file), `modules/repair/{types,mocks,api}.ts`, `src/proxy.ts`, `src/lib/**`
- `components/shared/**` — if you need a change there, write it in Open questions

## Run

```
cd frontend
npm run dev          # NEXT_PUBLIC_USE_MOCKS=true in .env.development
npm run lint && npm run typecheck
```

## Done when

- [ ] Every item in each screen's acceptance checklist passes (record below)
- [ ] lint + typecheck pass
- [ ] Each screen compared with its mockup at 375px and 1280px; differences listed below

## Checklist results (Codex fills)

| Screen | All checklist items pass? | Notes |
|---|---|---|
| | | |

## Differences from mockup (Codex fills)

-

## Open questions (Codex fills — never guess)

-
