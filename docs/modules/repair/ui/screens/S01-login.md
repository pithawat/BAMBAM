# S01 — เข้าสู่ระบบ / ออกจากระบบแล้ว

Status: APPROVED (2026-10-14) · **login layout replaced by CR-019 (approved 2026-10-24)**

> **CR-019 (owner, 2026-10-24) — /login and /signed-out share one screen.** Visual source `bam-workplace-login-v7.html` (owner's file), ported 1:1 in `app/(auth)/login/login.css` (its sizes, pastel card colours, icons and breakpoints 1280 / 1050 / 520 / 360 px; app font and the primary token instead of the prototype's). /signed-out = the same screen with an info notice `ออกจากระบบแล้ว` / `ขอบคุณที่ใช้ BAMBAM` above the button; the button returns to `/`. Full page, no card frame: brand bar (logo · `WORKPLACE SERVICES` from sm · `ความช่วยเหลือ` pill) · audience chip `สำหรับพนักงาน CPAC สำนักงานใหญ่` · H1 `ทุกเรื่องในที่ทำงาน` / `ให้ BAM ช่วยดูแล` (primary, underline stroke) · `แจ้งซ่อม จองรถ และจองห้องประชุม` / `จัดการบริการในที่ทำงานได้จากที่เดียว` · the existing error / expired / maintenance alert · pill button `เข้าสู่ระบบด้วย RMC SSO` (lock + arrow; disabled in maintenance; never starts by itself) · `ใช้บัญชีบริษัทของคุณเพื่อเข้าใช้งาน` · `เข้าสู่ระบบเพื่อใช้บริการ` + 3 service tiles (not links) · footer `ดูแลทุกพื้นที่ ให้ทุกวันทำงานราบรื่น` · `BAM Workplace Services · CPAC สำนักงานใหญ่` · `ต้องการความช่วยเหลือ?`. Help dialog: `ต้องการความช่วยเหลือ?` / `หากเข้าสู่ระบบด้วยบัญชีบริษัทไม่ได้ กรุณาติดต่อผู้ดูแล RMC SSO ของหน่วยงาน` / `สำหรับบริการแจ้งซ่อม จองรถ และจองห้องประชุม สามารถติดต่อผู้ดูแลบริการผ่านช่องทางภายในบริษัท` / `เข้าใจแล้ว`. Above 1050 px: decorative tilted cards (แจ้งซ่อม · จองรถ · จองห้องประชุม · บัญชีเดียว ครบทุกบริการ) and the `login` mascot with `พร้อมช่วยดูแลครับ` on the right — the bubble never overlaps a card; at 1050 px and below the cards hide and the mascot sits above the chip. The prototype's design-preview controls are not built.

- **Flows:** F01 steps 1–2, 5 and edge cases (see ../../02-flows.md)
- **Persona:** every role, mobile and desktop (see ../../01-users.md)
- **Purpose of this screen (one sentence):** start RMC SSO login on purpose (no auto-redirect) and confirm logout without logging in again.
- **Route:** `/login` (`app/(auth)/login`), `/signed-out` (`app/(auth)/signed-out`) — platform routes, public
- **Mockup:** none. Closest: `docs/shared/style/options/option-a.html` (gradient hero, white card overlapping it, mascot)
- **Data:** none on this page. The button goes to the login start endpoint in `docs/shared/integrations/sso.md`; `?error=` and `?reason=` come from the callback / `proxy.ts`; `?next=` keeps the page to return to.

## Layout — mobile first

```
┌────────────────────────────┐
│ bg-brand, 2–3 soft circles │
│                            │
│      [Mascot full 200px]   │
│                            │
│┌──────────────────────────┐│ ← white card, radius 26, shadow-float,
││ [BAM logo 96px]          ││   overlaps the gradient by ~54px
││ ยินดีต้อนรับสู่ BAMBAM     ││ ← Display
││ ศูนย์รวมบริการที่ทำงาน…   ││ ← Body, muted
││ [Alert: error / expired] ││ ← only when ?error / ?reason
││ [   เข้าสู่ระบบ   ]       ││ ← Button default, full width, h-12
││ ใช้บัญชี RMC SSO …       ││ ← Caption, centered
│└──────────────────────────┘│
│                            │
│ CPAC สำนักงานใหญ่          │ ← Caption, centered, bottom
└────────────────────────────┘
```

Signed-out (`/signed-out`): same frame, mascot `face`, title "ออกจากระบบแล้ว", button "เข้าสู่ระบบอีกครั้ง". Never starts login on its own.

Desktop (≥1024px): two columns in a centered 1120px frame.
- Left 55%: `bg-brand` panel, radius 30px, circles, mascot `full` 280px bottom-right, Display headline "เจออะไรเสีย บอก BAMBAM" + Body "แจ้งซ่อม ติดตามงาน และตรวจรับ ได้ทั้งบนมือถือและคอมพิวเตอร์".
- Right 45%: white card (radius 24, shadow-card, padding 40) with the same content as the mobile card.

## Components

| Area | Component (design-system.md) | Notes |
|---|---|---|
| Background | `bg-brand` + translucent circles | as Home hero |
| Mascot | `Mascot` pose `full` (login) / `face` (signed-out) | decorative, `aria-hidden` |
| Logo | `next/image` of the BAM logo (Stage 0 exports it to `public/brand/`) | alt "BAMBAM" |
| Card | `Card` radius-xl, `shadow-float` | |
| Messages | `Alert` (destructive for error; default for expired / maintenance) | |
| Button | `Button` default `rounded-full h-12 w-full` | spinner + disabled while redirecting |

## Content and copy (exact Thai text)

| Element | Text |
|---|---|
| Title (login) | ยินดีต้อนรับสู่ BAMBAM |
| Subtitle (login) | ศูนย์รวมบริการที่ทำงาน สำหรับพนักงาน CPAC สำนักงานใหญ่ |
| Primary button (login) | เข้าสู่ระบบ |
| Hint under button | ใช้บัญชี RMC SSO เดียวกับระบบอื่นของบริษัท |
| Footer | CPAC สำนักงานใหญ่ |
| Desktop headline | เจออะไรเสีย บอก BAMBAM |
| Desktop sub-headline | แจ้งซ่อม ติดตามงาน และตรวจรับ ได้ทั้งบนมือถือและคอมพิวเตอร์ |
| `?error=…` (SSO refused, user cancelled, token invalid) | Alert title: เข้าสู่ระบบไม่สำเร็จ · body: กรุณาลองใหม่ |
| `?reason=expired` | Alert title: เซสชันหมดอายุ · body: กรุณาเข้าสู่ระบบอีกครั้ง ระบบจะพากลับไปหน้าเดิม |
| `?reason=maintenance` | Alert title: ปิดปรับปรุงชั่วคราว · body: ระบบเข้าสู่ระบบ RMC SSO ปิดปรับปรุงอยู่ กรุณาลองใหม่ภายหลัง |
| Title (signed-out) | ออกจากระบบแล้ว |
| Subtitle (signed-out) | ขอบคุณที่ใช้ BAMBAM |
| Button (signed-out) | เข้าสู่ระบบอีกครั้ง |

## States

| State | What shows |
|---|---|
| Loading | Static page, nothing to load. After tapping the button: spinner in the button, label stays, disabled. |
| Empty | — |
| Error | `?error=` → destructive Alert above the button (copy above). The button still works. |
| Forbidden | — (public page). A user who already has a session and opens `/login` is sent to `?next=` or `/`. |
| Success feedback | — (SSO returns to the callback, then to `?next=` or `/`). |
| Maintenance | `?reason=maintenance` → Alert, button disabled. Guard itself is built before production (F01 edge case). |

## Interactions

- Tap "เข้าสู่ระบบ" / "เข้าสู่ระบบอีกครั้ง" → start login per `sso.md`, carrying `next` (only same-origin relative paths are allowed; anything else becomes `/`).
- `/signed-out` never redirects or starts login by itself.
- Validation: none.

## Acceptance checklist (Codex reports results in ../HANDOFF.md — does not edit this file)

- [ ] Matches the layout at 375px and 1280px (no mockup — follows option-a.html hero + card pattern)
- [ ] Uses only design-system tokens and shadcn components
- [ ] Error, expired and maintenance messages show with the exact copy, driven by the query string
- [ ] `/signed-out` does not start login automatically
- [ ] `next` only accepts same-origin relative paths
- [ ] Keyboard and screen-reader basics (button reachable, mascot `aria-hidden`, logo alt text)
- [ ] Works with mocks (`NEXT_PUBLIC_USE_MOCKS=true`)
