# Design system

Status: APPROVED (2026-10-14) · pickers / filters updated by CR-002 (repair, approved 2026-10-14)

<!-- Written by Claude in /style-options. User picked Option A as-is (D-018).
     Before Stage 0 this file holds the token values; after Stage 0 the VALUES live in
     frontend/src/app/globals.css and this file stays the source for USAGE rules. -->

## Direction

- Chosen option: **A — ฟ้าไล่ม่วง (Bold & friendly)**, no changes. Visual reference: `style/options/option-a.html`
- In one sentence: a friendly, spacious, Paotang-like app look built on the BAM logo gradient. Gradient headers with soft round shapes, white rounded cards floating over the header, pill buttons, soft 3D service icons, and the BAMBAM mascot greeting the user.
- Light mode only. No dark mode (user, 2026-10-14).
- Taken from references:
  - `paotang-03-pay-home.jpg` → gradient header with round translucent shapes, greeting, white card overlapping the header, pill primary button
  - `paotang-02-home.jpg`, `paotang-07-chart-bottomnav.jpg` → 5-slot bottom nav with a raised round center button (here: scan QR → F13-B)
  - `paotang-05`, `paotang-08` → each service has its own header color with a curved bottom edge
  - `paotang-06-service-wallet-list.jpg` → white card list rows with a status icon circle, time under the title, `›` to drill in
  - `paotang-09-form.jpg` → back + centered title header, large rounded inputs, select with chevron
  - `paotang-01-hero.jpg` → soft 3D icon look (our own icons, not theirs)
  - `bam-logo.png` → brand gradient `#1075FA → #2741FA → #7930FA`; `mascot-bambam-leopard.png` → mascot
- Never ship Paotang images, icons or logos. They are reference only.

## Typography

Both fonts load through `next/font/google` with `subsets: ["thai", "latin"]` and `display: "swap"`.

| Role | Font (next/font/google) | Weight | Size / line-height |
|---|---|---|---|
| Display (greeting, hero) | `Prompt` | 700 | 28 / 38 |
| H1 (page title) | `Prompt` | 600 | 24 / 34 |
| H2 (section title) | `Prompt` | 600 | 20 / 29 (mobile sections 18 / 25) |
| H3 (card / item title) | `Anuphan` | 600 | 16 / 24 |
| Body | `Anuphan` | 400, 500 | 15 / 25 |
| Small (meta: location, time) | `Anuphan` | 400 | 13.5 / 22 |
| Caption | `Anuphan` | 400 | 12.5 / 19 (12 is the minimum anywhere) |
| Buttons, tabs, badges with numbers | `Prompt` | 600 | 15 (button), 13.5 (small button) |
| Ticket number / IDs | `Prompt` | 600 | 12.5, letter-spacing .02em |

- Load Prompt with weights `500, 600, 700` (`variable: "--font-prompt"`) and Anuphan with weights `400, 500, 600` (`variable: "--font-anuphan"`).
- Ticket numbers follow D-015 (`RP-2569-000142`). The option file used a short sample (`RP-0142`).
- Dates: `14 ต.ค. 2569 10:15` (Thai short month, BE year, 24h). In lists for today you may show the time only.

## Tokens — paste into `frontend/src/app/globals.css`

Tailwind v4 + shadcn/ui format. Contrast checked: body text and every text-on-tint pair is ≥ 4.5:1.

```css
:root {
  --radius: 1.25rem;                 /* 20px */

  --background: #F2F5FF;
  --foreground: #0E1736;
  --card: #FFFFFF;
  --card-foreground: #0E1736;
  --popover: #FFFFFF;
  --popover-foreground: #0E1736;
  --primary: #2741FA;
  --primary-foreground: #FFFFFF;
  --secondary: #E7ECFF;
  --secondary-foreground: #1A2FC9;
  --muted: #EAEEFA;
  --muted-foreground: #535D82;
  --accent: #E7ECFF;
  --accent-foreground: #1A2FC9;
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
  --border: #DFE5F5;
  --input: #CDD6EE;
  --ring: #2741FA;

  --sidebar: #FFFFFF;
  --sidebar-foreground: #0E1736;
  --sidebar-primary: #2741FA;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #E7ECFF;
  --sidebar-accent-foreground: #1A2FC9;
  --sidebar-border: #DFE5F5;
  --sidebar-ring: #2741FA;

  /* app-specific */
  --success: #067647;
  --warning: #B54708;
  --status-new: #B54708;             /* รอช่างรับงาน */
  --status-in-progress: #1F4FD8;     /* ช่างกำลังดำเนินการ */
  --status-resolved: #6D28D9;        /* ซ่อมเสร็จ รอตรวจรับ */
  --status-closed: #067647;          /* ปิดงานแล้ว */
  --priority-high: #C4320A;          /* สูง; ฉุกเฉิน uses --destructive */
  --svc-repair: #F97316;             /* แจ้งซ่อม — icons/backgrounds only, never text */
  --svc-car: #0EA5A4;                /* จองรถ */
  --svc-room: #8B5CF6;               /* จองห้องประชุม */
  --brand-gradient: linear-gradient(120deg, #1075FA 0%, #2741FA 52%, #7930FA 100%);
}

@theme inline {
  --font-sans: var(--font-anuphan);
  --font-heading: var(--font-prompt);

  --radius-sm: calc(var(--radius) - 4px);   /* 16px inputs, nav items */
  --radius-md: calc(var(--radius) - 2px);   /* 18px */
  --radius-lg: var(--radius);               /* 20px */
  --radius-xl: calc(var(--radius) + 4px);   /* 24px cards */
  --radius-2xl: calc(var(--radius) + 10px); /* 30px desktop banner */

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-status-new: var(--status-new);
  --color-status-in-progress: var(--status-in-progress);
  --color-status-resolved: var(--status-resolved);
  --color-status-closed: var(--status-closed);
  --color-priority-high: var(--priority-high);
  --color-svc-repair: var(--svc-repair);
  --color-svc-car: var(--svc-car);
  --color-svc-room: var(--svc-room);

  --shadow-card: 0 12px 30px -14px rgb(39 65 250 / 0.22), 0 2px 6px rgb(14 23 54 / 0.04);
  --shadow-float: 0 18px 36px -16px rgb(39 65 250 / 0.35);   /* card overlapping a header */
  --shadow-brand: 0 10px 20px -10px rgb(39 65 250 / 0.7);    /* gradient buttons, scan button */
  --shadow-nav: 0 -8px 30px -12px rgb(14 23 54 / 0.18);      /* mobile bottom nav */
}

@utility bg-brand {
  background-image: var(--brand-gradient);
}
```

No `.dark` block. Dark mode is out of scope.

## Layout and spacing

- **Adaptive (D-008):** each screen spec defines a mobile layout and a desktop layout. Switch at Tailwind `lg` (1024px): below it use the mobile app layout, from it the desktop web layout. They are separate layouts that share tokens and components, not one fluid layout.
- **Mobile (< lg):**
  - page padding 16px; content max-width 560px, centered (tablets in mobile layout)
  - Header: `bg-brand` with rounded bottom (34px) and 2–3 translucent circles. Greeting/title in white. The first card overlaps the header by ~54px (`shadow-float`).
  - Bottom nav: white, top radius 26px, `shadow-nav`, 88px + `env(safe-area-inset-bottom)`. Five slots: หน้าแรก · ติดตามงาน (CR-003) · **สแกน** (raised 58px `bg-brand` circle, 4px white ring, `shadow-brand`) · แจ้งเตือน · โปรไฟล์. Scrolling content gets ~110px bottom padding.
  - Sub-pages (forms, details) use a white top bar instead: back button + centered title (`paotang-09`).
- **Desktop (≥ lg):**
  - left sidebar 256px (shadcn `Sidebar`), main padding 32px, content max-width 1280px
  - top bar: page title · search (pill) · role switcher · bell
  - Home shows a `bg-brand` banner (radius 30px) with the full-body mascot.
- **Spacing:** 4px base. Card padding 16–18px. Gap between cards 10–12px (mobile) / 18px (desktop). Section gap 22–24px.
- **Density: spacious.**
  - Touch targets ≥ 44px; buttons 48px (default) / 36px (sm)
  - inputs 52px
  - mobile list rows ≥ 64px; desktop table rows 60–64px

## Component usage

| Need | Use | Notes |
|---|---|---|
| Primary action | `Button` default — `rounded-full h-12` | Max one per screen area |
| Hero / key CTA on a gradient-adjacent card | `Button` variant `brand` (`bg-brand text-white shadow-brand`) | Add as a cva variant. Only "แจ้งซ่อม" on Home and the main submit of a flow |
| Button on top of a gradient | variant `white` (`bg-white text-primary`) / `glass` (`bg-white/20 border-white/45 text-white`) | Add as cva variants |
| Secondary / cancel | `Button` outline or secondary | |
| Text action ("ส่งกลับให้แก้") | `Button` link | |
| Status | `Badge` + text: `bg-status-*/10 text-status-*` with a leading dot | Never color alone; labels from the status table in `02-flows.md` |
| "รอคุณตรวจรับ" | `Badge` solid `bg-status-resolved text-white` | Also tint that item's card: `bg-status-resolved/5 border-status-resolved/15` |
| Priority | `PriorityIndicator` (`components/shared`): 3 bars + text | ฉุกเฉิน = destructive, สูง = priority-high, ปกติ / ต่ำ = muted-foreground |
| Service icon | `ServiceIcon` (`components/shared`): 52px circle, radial highlight of the `svc-*` color, white lucide icon 26px | Disabled = desaturated + "เร็วๆ นี้" chip |
| Service screen header | `ServiceHeader` (`components/shared`): `svc-*` gradient, curved bottom, white icon circle | Repair screens orange, car teal, room violet; Home and cross-module screens use `bg-brand` |
| Data list (mobile) | `Card` list: status icon circle 40px · title · meta · badge · `›` | Rows divided by `border` lines inside one card (`paotang-06`) |
| Data list (desktop) | `Table` inside `Card` (rounded-xl, `shadow-card`), header row `bg-muted` with rounded ends | Title column wraps; meta under the title |
| Filters / tabs | Pill segments (`Tabs` or `ToggleGroup` styled as pills; active = `bg-foreground text-white`) | Show counts: "รอตรวจรับ 1" |
| Choice with ≤ 4 options in a toolbar (CR-002) | Segmented control: `ToggleGroup` single in a white pill track, active segment `bg-foreground text-white` | e.g. S06 scope, date range in a sheet |
| Dropdown filter (CR-002) | `FilterPill` (`components/shared`) | See Patterns → Pickers |
| Forms | shadcn `Form` + `Input` / `Textarea`, `h-13 rounded-sm` (16px); choices via `ChoiceField` / `Picker` (CR-002) — never `components/ui/select` directly | See Patterns |
| Notifications | Bell with red count badge; list rows with icon circle + time, unread dot `bg-primary` | |
| Mobile navigation | `BottomNav` (`components/shared`) | Spec in Layout |
| Desktop navigation | shadcn `Sidebar` | Active item `bg-secondary text-secondary-foreground` rounded 16px |
| Role switcher (D-005) | `RoleSwitcher` (`components/shared`) | Mobile: translucent pill in the header. Desktop: amber dashed pill in the top bar. Always shows a "UAT"/"DEV" tag. Not rendered unless `NEXT_PUBLIC_ROLE_SWITCHER=true` |
| Mascot | `Mascot` (`components/shared`) with `pose` = `full` / `bust` / `face` | One source image for now (crops). Export optimized WebP into `frontend/public/brand/` in Stage 0 |
| Confirm destructive | `AlertDialog` | |
| Feedback | toast (`sonner`) | Success toasts are short; errors that block work use inline `Alert` |
| Icons | `lucide-react`, stroke 2, 20px (16 small, 26 in service icons) | |

## Patterns

- **Empty state:**
  - soft card `bg-linear-to-b from-secondary to-status-resolved/5`, `rounded-xl`
  - mascot `full` ~120px
  - title in H3 Prompt
  - one-line hint in Small
  - one primary small button (e.g. "แจ้งซ่อม")
- **Error state:**
  - **Part of the page fails:** inline `Alert` destructive (icon, bold title, plain-language cause), then a full-width outline "ลองอีกครั้ง". The rest of the page stays usable.
  - **The whole page fails:** mascot + title + retry.
- **Forbidden:** mascot `bust` + "คุณไม่มีสิทธิ์เข้าหน้านี้" + short reason + button "กลับหน้าแรก". Never show partial data.
- **Loading:** `Skeleton` shaped like the final layout (header block, cards, rows). No full-page spinner.
  - Buttons: spinner + disabled, and the label stays.
  - Pull-to-refresh is not needed in phase 1.
- **Forms:**
  - label above the field (Small 500); required marker `*` in destructive; hint below in muted-foreground
  - **Errors:** shown below the field with an alert icon, red border plus a light red ring. Validate on submit first, then on change.
  - **Mobile:** the main submit is a full-width button in a sticky bottom bar.
  - **Desktop:** right-aligned button row.
- **Pickers (dropdowns) (CR-002)** — research and visuals: `docs/modules/repair/changes/CR-002/dropdowns.html`:
  - **Which control** (`ChoiceField`, `components/shared`): ≤ 5 options → pill radios (`RadioGroup`, 48px pills, selected `bg-foreground text-white`) · 6–12 → grid of buttons (4 columns mobile, one row on desktop when it fits) · > 12 → `Picker`. A filter with ≤ 4 options in a toolbar → segmented control.
  - **`Picker` trigger:** label above (never the placeholder as label) · 52px, `rounded-sm`, `border-input`, optional leading icon (only if sibling pickers have one) · value 15px, placeholder `text-muted-foreground` · chevron rotates when open · hover: darker border · open/focus: `border-ring` + 3px `ring/20` · invalid: `border-destructive` + message below linked with `aria-describedby` · disabled: `bg-muted` + a hint that says why.
  - **Desktop menu:** opens **under** the trigger (`position="popper"`, offset 6px), same width as the trigger, `rounded-md` (18px), 6px padding, `shadow-float`, max height ≈ 5.5 rows so the 6th row peeks; flips up near the bottom edge.
  - **Options:** 44px rows (56px with a description), 15px, `rounded-sm`; highlighted (pointer / keyboard) = `bg-muted`; **selected = `bg-secondary text-secondary-foreground font-semibold` + `Check` on the right** — the two never look the same; unavailable options are dimmed, not hidden.
  - **Long lists:** > 10 options → a search field at the top of the menu / sheet; no match → "ไม่พบ{ชื่อช่อง}ที่ค้นหา". Typeahead always works.
  - **Mobile (< lg):** a bottom `Sheet`: title = field label (+ context line, e.g. the building), close button, 52px rows with the same selected style, picking closes the sheet, Back closes it, never stack sheets.
  - **`FilterPill`:** 44px pill (40px in dense desktop toolbars) reading "{ชื่อ}: {ค่า}" with a leading icon; default value first ("ทั้งหมด…"); active (non-default) = `bg-secondary` + primary-tinted border + ✕ button that clears only that filter; show "ล้างตัวกรอง" when ≥ 1 filter is active; a pick applies at once. On mobile, filters collapse into a "ตัวกรอง" button with a count that opens a sheet.
  - **Accessibility:** Radix / APG keyboard model (Enter / Space / ↓ open, Esc closes without changing, Home / End); the accessible name always includes the field label, not just the value; targets ≥ 44px.
- **Success after submit:** full screen or sheet with the mascot, ticket number and next step (as in F02).
- **Lists:** items waiting for the current user go on top in their own highlighted card (BR-F06-2), then the rest in one list card.

## Do / Don't

- **Do:**
  - Use the brand gradient for headers, the Home banner, the scan button and the one hero CTA.
  - Keep everything else on white cards with `shadow-card`.
  - Use pill buttons, generous spacing and 44px+ touch targets.
  - Always pair status color with text.
  - Use service colors to tell the three systems apart (icons, service headers).
  - Use realistic Thai copy from the screen specs.
- **Don't:**
  - Don't use Paotang images, icons or logos.
  - Don't use `svc-*` colors or the gradient for text. Orange/teal on white fail contrast.
  - Don't use hex or arbitrary values in components; use tokens and utilities only.
  - Don't stack more than one gradient surface in the same viewport area.
  - Don't stretch, recolor or redraw the mascot.
  - Don't add a dark theme.
  - Don't show the role switcher in production.
