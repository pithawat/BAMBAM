# S16 — สแกน QR

Status: APPROVED (2026-10-14)

- **Flows:** F13-B steps A–B ("ปุ่มสแกนในแอป"), BR-F13B-1 (see ../../02-flows.md)
- **Persona:** every role on mobile, standing at the equipment (see ../../01-users.md)
- **Purpose of this screen (one sentence):** scan the QR on a piece of equipment inside the app and open the report form already filled in.
- **Route:** `/repair/scan`
- **Mockup:** none. Closest: `../mockups/S03-report-form.html` (top bar, QR banner, sheet)
- **Data:** asset lookup by code (same call as S03) → `modules/repair/api.ts`. Scanning with the phone's own camera opens the QR URL directly (S03 `?asset=`) and never uses this screen.

## Layout — mobile first

```
┌────────────────────────────┐
│ live camera, full screen      │
│ dark overlay bg-foreground/60 │ ← except the frame window
│ ←  สแกน QR แจ้งซ่อม          │ ← top bar, white text/icons over the camera
│                              │
│      ┌──          ──┐        │
│      │   (window)    │        │ ← 240px square, white corner marks 4px,
│      │  ─ ─ ─ ─ ─ ─  │        │   scanning line (hidden with reduced motion)
│      └──          ──┘        │
│   ส่องกล้องไปที่ QR บนอุปกรณ์     │ ← H3 white
│   ระบบจะเติมข้อมูลอุปกรณ์ให้อัตโนมัติ │ ← Small white/80
│                              │
│ [ ⌨ กรอกรหัสอุปกรณ์เอง ] (glass) │ ← Button glass, full width
│     แจ้งซ่อมโดยไม่สแกน          │ ← Button link, white
└────────────────────────────┘
```

Manual-code sheet (bottom `Sheet`): label "รหัสอุปกรณ์" + `Input` (placeholder "เช่น AC-05-012", uppercase, autocomplete off) + "ค้นหา" (default, full width).

Camera blocked / no camera: replace the camera with the page background and a centered card: mascot `bust` + "เปิดกล้องไม่ได้" + hint + buttons "ลองอีกครั้ง" (default) and "กรอกรหัสอุปกรณ์เอง" (outline).

Desktop (≥1024px): sidebar + top bar (title "สแกน QR แจ้งซ่อม"). No camera view; centered card 560px: `QrCode` icon circle + "ใช้กล้องมือถือสแกน QR บนอุปกรณ์ได้เลย ไม่ต้องเปิดแอปก่อน" + the manual-code field inline + "ค้นหา"; link "แจ้งซ่อมโดยไม่สแกน".

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Camera | module component `QrScanner` (`BarcodeDetector` where available, otherwise a JS decoder) | library confirmed in `/stage-plan`; camera stops when leaving the page |
| Overlay text | white text on `bg-foreground/60` | the only dark surface in the app; text contrast ≥ 4.5:1 |
| Buttons | `Button` variant `glass` + link | |
| Manual code | `Sheet` + `Input` + `Button` | |
| Blocked state | `Card` + `Mascot` bust | |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | สแกน QR แจ้งซ่อม |
| Instruction | ส่องกล้องไปที่ QR บนอุปกรณ์ |
| Hint | ระบบจะเติมข้อมูลอุปกรณ์ให้อัตโนมัติ |
| Manual button | กรอกรหัสอุปกรณ์เอง |
| No-scan link | แจ้งซ่อมโดยไม่สแกน |
| Sheet | title: กรอกรหัสอุปกรณ์ · label: รหัสอุปกรณ์ · placeholder: เช่น AC-05-012 · button: ค้นหา |
| Manual code not found | under the field: ไม่พบอุปกรณ์รหัสนี้ |
| Manual code empty | under the field: กรุณากรอกรหัสอุปกรณ์ |
| QR not from BAMBAM | toast: QR นี้ไม่ใช่ของ BAMBAM (keeps scanning) |
| Camera blocked | title: เปิดกล้องไม่ได้ · hint: อนุญาตให้ BAMBAM ใช้กล้องในการตั้งค่าเบราว์เซอร์ หรือกรอกรหัสอุปกรณ์เอง · buttons: ลองอีกครั้ง / กรอกรหัสอุปกรณ์เอง |
| Desktop hint | ใช้กล้องมือถือสแกน QR บนอุปกรณ์ได้เลย ไม่ต้องเปิดแอปก่อน |

## States

| State | What shows |
|---|---|
| Loading | Camera starting → black screen with the frame and a small spinner in the window. Manual "ค้นหา" → spinner in the button. |
| Empty | — |
| Error | Camera blocked / missing → blocked card. Lookup network error → toast "ทำรายการไม่สำเร็จ ลองอีกครั้ง". |
| Forbidden | — |
| Success feedback | Valid code → vibrate 50 ms (if supported) → navigate to S03 `/repair/new?asset={code}` (S03 shows the prefill banner). |

## Interactions

- A QR is valid when it is a BAMBAM asset URL for this environment (format fixed in `/stage-plan`, F13-A). Extract the asset code and go to S03; S03 handles "not found" (F13-B).
- Manual code → lookup first; found → S03 with `?asset=`; not found → message under the field (stay).
- "แจ้งซ่อมโดยไม่สแกน" → S03 without prefill.
- Back → previous page; camera stops.
- Validation: manual code required, trimmed, uppercase, max 30 characters.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Follows the layout at 375px (camera, blocked, manual sheet) and 1280px (manual only)
- [ ] Camera stops on leave; reduced motion hides the scanning line
- [ ] Non-BAMBAM QR shows the toast and keeps scanning
- [ ] Manual code: empty / not found / found paths with the exact copy
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (manual entry fully usable without a camera)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`): `AC-05-012` found, any other code not found
