# S15 — ตัวสลับบทบาท (dev / UAT)

Status: APPROVED (2026-10-14)

- **Flows:** F01-B (all), BR-F01B-1 … BR-F01B-3, D-005 (see ../../02-flows.md)
- **Persona:** testers in dev and UAT (see ../../01-users.md)
- **Purpose of this screen (one sentence):** switch the session to the seeded demo user of any role, and always show that the app is in test mode.
- **Route:** none — `RoleSwitcher` in `components/shared`, rendered by the app shell only when `NEXT_PUBLIC_ROLE_SWITCHER=true`
- **Mockup:** trigger pill is in `docs/shared/style/options/option-a.html` (mobile hero + desktop top bar). The picker itself has no mockup; follows this spec.
- **Data:** `POST /api/v1/dev/role-switch { "role": "<role>" }` (architecture.md) + `GET /api/v1/me` to read the current role / demo flag

## Layout — mobile first

Triggers (always visible in dev/UAT — F01-B "แสดงตลอด"):
- pages with a gradient header — `bg-brand` (S02, S13, S14) or the orange `ServiceHeader` (S06, S09): translucent pill `bg-white/20 text-white` at the top of the header — `[UAT] 👁 ดูในบทบาท: {role} ▾`
- pages with a white top bar or full screen (S03, S05, S07, S10, S11 mobile, S12 mobile, S16): a 28px amber strip above everything — `UAT · กำลังดูในบทบาท: {role} · เปลี่ยน`
- S01 has no session, so nothing is shown there
- desktop: amber dashed pill in the top bar (option-a.html)

Picker (mobile: bottom `Sheet`; desktop: `Popover` 360px under the pill):

```
┌──────────────────────────┐
│ ดูในบทบาท              ✕ │ ← H3
│ โหมดทดสอบ ใช้ผู้ใช้ตัวอย่าง    │ ← Caption muted
│ ไม่เปลี่ยนสิทธิ์ของบัญชีจริง     │
│ ◉ พนักงานทั่วไป              │ ← RadioGroup rows ≥ 52px
│   วรรณา สุขประเสริฐ (ตัวอย่าง)  │   role label (H3) + demo user (Small muted)
│ ○ หัวหน้าแม่บ้าน             │
│   มาลี ทองดี (ตัวอย่าง)       │
│ ○ หัวหน้ารปภ.               │
│ ○ ช่างเทคนิค                 │
│ ○ Admin                    │
│ ○ ผู้บริหาร                  │
│ [        สลับบทบาท        ] │ ← Button default, disabled until a different role is picked
└──────────────────────────┘
```

Tag colors (same in every place): env chip `UAT` / `DEV` amber (as option-a `.rs .env`), pill `bg-warning/10 text-warning border-dashed` on desktop. These are the only amber surfaces in the app.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Trigger | `RoleSwitcher` (pill / strip variants) | `components/shared` |
| Picker | `Sheet` bottom (mobile) / `Popover` (desktop) + `RadioGroup` | |
| Submit | `Button` default | spinner while switching |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Env chip | UAT · DEV (from config) |
| Pill | ดูในบทบาท: {role label} |
| Strip | {ENV} · กำลังดูในบทบาท: {role label} · เปลี่ยน |
| Picker title | ดูในบทบาท |
| Picker hint | โหมดทดสอบ ใช้ผู้ใช้ตัวอย่าง ไม่เปลี่ยนสิทธิ์ของบัญชีจริง |
| Role rows | {role label} / {demo user name} (ตัวอย่าง) — role labels `_common.md` §2 |
| Submit | สลับบทบาท |
| Success toast | กำลังดูในบทบาท {role label} |
| Error toast | สลับบทบาทไม่สำเร็จ ลองอีกครั้ง |
| Pill when the real account is in use (not a demo user yet) | ดูในบทบาท: {own role label} |

## States

| State | What shows |
|---|---|
| Loading | Submit spinner; the rest of the app is not touched until the switch returns. |
| Empty | — |
| Error | Error toast; picker stays open. |
| Forbidden | Production: nothing rendered, no strip, no pill (BR-F01B-1). |
| Success feedback | Session replaced → full reload to `/` → toast. |

## Interactions

- Pick a role → "สลับบทบาท" → `POST /api/v1/dev/role-switch` → hard navigation to `/` (all cached data dropped) → toast.
- Every switch is audited by the backend (BR-F01B-3); nothing extra in the UI.
- Picking the current role keeps the button disabled.
- Validation: none.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Pill matches option-a.html (mobile hero, desktop top bar); strip shows on white-top-bar / full-screen pages
- [ ] Picker lists the 6 roles with demo user names; current role selected
- [ ] Switch reloads to Home with the new role's data
- [ ] Not rendered at all when `NEXT_PUBLIC_ROLE_SWITCHER` is not `true`
- [ ] Uses only design-system tokens and shadcn components
- [ ] Keyboard and screen-reader basics (radio group, popover focus)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`): switching changes the mock user

## Open questions

- How does a tester go back to their own account? Proposed: "ออกจากระบบ" then log in again (no extra button). Decide in `/stage-plan`.
