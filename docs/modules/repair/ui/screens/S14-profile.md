# S14 — โปรไฟล์

Status: APPROVED (2026-10-14)

- **Flows:** F01 steps 4–5 (read-only profile, logout), BR-F01-3 (see ../../02-flows.md)
- **Persona:** every role (see ../../01-users.md)
- **Purpose of this screen (one sentence):** show who I am in BAMBAM (SSO data + role) and let me log out.
- **Route:** `/profile` (`app/(app)/profile`) — platform route
- **Mockup:** none. Closest: `docs/shared/style/options/option-a.html` (gradient header, white cards, sidebar user card)
- **Data:** current user (`GET /api/v1/me`: SSO claims used by the app + role + technician categories) → `lib` / platform API (names fixed in 04-api-contract.md / architecture.md)

## Layout — mobile first

```
┌────────────────────────────┐
│ bg-brand short header         │
│        (วร) 72px avatar       │ ← initials, white ring
│     วรรณา สุขประเสริฐ           │ ← H1 white
│     พนักงานบัญชีอาวุโส          │ ← Small white/90 (POSITION_TH)
│┌──────────────────────────┐│ ← card overlaps header
││ ข้อมูลจาก RMC SSO           ││ ← H3
││ รหัสพนักงาน      600123      ││ ← rows: label (Small muted) / value (Body)
││ ชื่อ-นามสกุล      วรรณา สุขประเสริฐ ││
││ ตำแหน่ง         พนักงานบัญชีอาวุโส ││
││ ฝ่าย / แผนก      ฝ่ายบัญชี / แผนกบัญชีทั่วไป ││
││ อีเมล           wanna.s@…    ││
│└──────────────────────────┘│
│┌──────────────────────────┐│
││ บทบาทใน BAMBAM             ││
││ [พนักงานทั่วไป]               ││ ← Badge secondary
││ (technician) หมวดงานที่รับผิดชอบ ││
││ [ระบบปรับอากาศ][ไฟฟ้าและแสงสว่าง] ││ ← Badge outline chips
│└──────────────────────────┘│
│ ข้อมูลอัปเดตจาก RMC SSO ทุกครั้งที่เข้าสู่ระบบ แก้ไขในแอปนี้ไม่ได้ │ ← Caption muted, centered
│ [ ⇥ ออกจากระบบ ]             │ ← Button outline, full width
│ BAMBAM · UAT · v0.1.0        │ ← Caption muted, centered
├────────────────────────────┤
│ BottomNav (โปรไฟล์ active)     │
└────────────────────────────┘
```

Desktop (≥1024px): sidebar + top bar (title "โปรไฟล์"). Centered column 760px: a profile card (avatar 72px + name + position, no gradient) then the two cards side by side (2 columns), caption, and "ออกจากระบบ" outline button right-aligned. The sidebar user card also opens this page; its logout icon opens the same confirm.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Header | `bg-brand` short header + avatar (initials) | mobile |
| Info cards | `Card` + definition rows | |
| Role | `Badge` secondary; categories `Badge` outline | |
| Logout | `Button` outline with `LogOut` icon + `AlertDialog` | |
| Footer | Caption: app name · environment · version | env label from config, hidden in production |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title | โปรไฟล์ |
| Card 1 title | ข้อมูลจาก RMC SSO |
| Card 1 labels | รหัสพนักงาน · ชื่อ-นามสกุล · ตำแหน่ง · ฝ่าย / แผนก · อีเมล |
| Missing value | — |
| Card 2 title | บทบาทใน BAMBAM |
| Role labels | `_common.md` §2 |
| Technician categories label | หมวดงานที่รับผิดชอบ |
| Technician without categories | ยังไม่ได้กำหนดหมวดงาน ติดต่อ Admin |
| Caption | ข้อมูลอัปเดตจาก RMC SSO ทุกครั้งที่เข้าสู่ระบบ แก้ไขในแอปนี้ไม่ได้ |
| Logout button | ออกจากระบบ |
| Logout dialog | title: ออกจากระบบ? · body: คุณต้องเข้าสู่ระบบด้วย RMC SSO อีกครั้งเมื่อกลับมา · buttons: ยกเลิก / ออกจากระบบ |
| Demo-user note (role switcher active) | Alert default: คุณกำลังใช้ผู้ใช้ตัวอย่างในโหมดทดสอบ · body: ข้อมูลในหน้านี้เป็นข้อมูลตัวอย่าง ไม่ใช่บัญชีของคุณ |

## States

| State | What shows |
|---|---|
| Loading | Skeleton avatar, name bar, 5 rows, role chip. |
| Empty | Missing claim values show "—". |
| Error | Whole-page error (`_common.md` §6). |
| Forbidden | — |
| Success feedback | Logout → clears session → SSO End Session → S01 `/signed-out` (F01 step 5). Button shows spinner meanwhile. |

## Interactions

- "ออกจากระบบ" → confirm dialog → logout per `docs/shared/integrations/sso.md`.
- Email is plain text (no mailto needed).
- Validation: none (read-only, BR-F01-3).

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Follows the layout at 375px and 1280px
- [ ] Shows only the claims listed (no extra personal data; nothing from `LINE_USER_ID`)
- [ ] Technician categories render; other roles do not show that block
- [ ] Logout confirm → `/signed-out`
- [ ] Demo-user Alert shows only when the role switcher session is active
- [ ] Uses only design-system tokens and shadcn components
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
