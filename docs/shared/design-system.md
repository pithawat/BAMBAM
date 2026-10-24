# Design system

Status: APPROVED (2026-10-14) · pickers / filters updated by CR-002 (repair, approved 2026-10-14) · **rewritten by CR-008 (repair, approved 2026-10-16) — replaces Option A (D-018)**

<!-- Since Stage 0 the token VALUES live in frontend/src/app/globals.css; this file is the source for USAGE rules.
     CR-008 visual reference: docs/modules/repair/changes/CR-008/ (design demo 06: demo.css, style-and-form.html,
     ticket-detail.html, dashboard.html). -->

## Direction (CR-008)

- **Clean workplace app**: light gray canvas, white panels with thin borders, blue `#2741FA` as the one action colour, violet for highlights, strong solid colours only where a status needs attention. Calm, readable, no decoration that repeats information.
- **Read from top to bottom.** One column of content per screen on phones, and on desktop for forms and detail pages (max 800–1040px). Sections are stacked; no "left column then right column" reading order inside a form or a detail page. Dashboards and lists may use grids.
- Light mode only. No gradient headers, no 3D service icons. The BAMBAM logo and the mascot stay. Mascot = the BAM tiger, 5 poses (D-094, CR-019): page headings of S06 / S03 / S29, the S07 review band, login / signed-out, Home / S05 cards, empty / error / forbidden states; never in the navbar.
- Navigation (CR-010, D-064): one white top navbar (floating on desktop), three services with equal weight, no sidebar, no bottom nav — `docs/modules/repair/ui/screens/_common.md` §1.
- Never ship third-party images, icons or logos from the references.

## Typography

One family: **Anuphan** (`next/font/google`, `subsets: ["thai", "latin"]`, weights 400 / 500 / 600 / 700, `variable: "--font-anuphan"`). Prompt is dropped (CR-008).

| Role | Size / line-height | Weight |
|---|---|---|
| Page title (H1) | 28 / 39 (phone 24 / 34) | 600 |
| Section title (H2) | 19 / 28 (phone 18) | 600 |
| Card / item title (H3) | 16 / 24 | 600 |
| Body, field values | 15–16 / 25 | 400 / 500 |
| Label | 15 / 22 | 600 |
| Secondary text | 14 / 22 | 400 |
| Caption, timestamps | 13 / 19 (12 is the minimum anywhere) | 400 |
| Ticket numbers | 13.5, letter-spacing .02em | 600 |

Secondary text uses `text-muted-foreground` (`#667085`); never lighter grey for text.

## Tokens — `frontend/src/app/globals.css`

```css
:root {
  --radius: 0.75rem;                 /* 12px; controls rounded-sm 8px, cards rounded-xl 16px */
  --background: #F6F7FA;  --foreground: #182238;
  --card: #FFFFFF;        --card-foreground: #182238;
  --popover: #FFFFFF;     --popover-foreground: #182238;
  --primary: #2741FA;     --primary-foreground: #FFFFFF;
  --secondary: #EFF2FF;   --secondary-foreground: #1B31D6;   /* selected / soft blue */
  --muted: #F1F3F7;       --muted-foreground: #667085;
  --accent: #EFF2FF;      --accent-foreground: #1B31D6;
  --destructive: #C33432; --destructive-foreground: #FFFFFF;
  --border: #E5E8EF;      --input: #D0D6E2;  --ring: #2741FA;
  --sidebar: #FFFFFF; --sidebar-foreground: #182238; --sidebar-primary: #2741FA; --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #EFF2FF; --sidebar-accent-foreground: #2741FA; --sidebar-border: #E5E8EF; --sidebar-ring: #2741FA;

  --success: #117653;  --warning: #B54708;  --violet: #7543C5;
  /* step colours (S07 header band, action card, badges) */
  --status-new: #B54708;          /* รอช่างรับเรื่อง */
  --status-in-progress: #2741FA;  /* กำลังซ่อม */
  --status-rework: #C4320A;       /* กำลังแก้ไขตามที่ส่งกลับ */
  --status-resolved: #6A3FD3;     /* ซ่อมเสร็จ รอให้คะแนน */
  --status-closed: #117653;       /* ปิดงานแล้ว */
  /* priority */
  --priority-critical: #B42318;  --priority-high: #B93815;  --priority-medium: #3538CD;  --priority-low: #475467;
  /* services — icons only, never text */
  --svc-repair: #F97316;  --svc-car: #0EA5A4;  --svc-room: #8B5CF6;
}
```

Shadows: `--shadow-card: 0 1px 2px rgb(24 34 56 / .04)` (panels), `--shadow-raised: 0 10px 28px -16px rgb(24 34 56 / .25)` (review card, success card, dialogs). Contrast: every text / background pair ≥ 4.5:1 (white on each step colour ≥ 5:1).

## Colour themes (D-069, default recoloured by D-070, 2026-10-19)

Two themes, chosen per browser in the account menu → `ธีมสี` (stored in `localStorage` `bambam.theme`, applied before paint by `lib/theme.ts`). A theme only remaps the tokens above under `:root[data-theme="…"]`; components never branch on the theme, so never hard-code a hex in a component.

| Role | `default` มาตรฐาน | `calm` โทนสบายตา |
|---|---|---|
| Canvas / text / secondary text | `#F5F7FA` / `#172033` / `#5B6676` | `#F3F5F7` / `#1B2430` / `#566273` (6.2:1) |
| Action, in progress | `#2741FA` | `#2741FA` (unchanged) |
| Needs you (`--attention`, `--status-resolved`; badge, banner edge — buttons stay blue) | tangerine `#B93D0A` (4.9:1 on its tint) | deep mustard `#8A5A12` (5.9:1) |
| Done (`--success`, `--status-closed`) | emerald `#0B7A5E` | deep sage `#2C6B67` (6.2:1) |
| Waiting (`--status-new`) · sent back (`--status-rework`) | deep yellow `#8C6600` (CR-018, was slate) · red `#B42318` | olive yellow `#7F6A00` (CR-018) |
| Warning / stars | `#B54708` / `#E09B0C` | `#94600F` / `#C08A2E` (3:1) |
| Field border (`--input`) | `#D0D6E2` | `#B0B8C3` |

`calm` comes from the owner's palette `#2741FA · #C5CBD3 · #8CBCB9 · #DDA448`: the pale sage and mustard fail text contrast on white (2.1:1, 2.2:1), so only their deep shades carry text and icons; the pale shades appear as tints. Light only, like the default. **No purple anywhere (D-070):** services are orange แจ้งซ่อม `#F97316` · sky จองรถ `#0284C7` · teal จองห้องประชุม `#0D9488`; priority ปกติ is blue `#2741FA`; avatars use the soft blue. The BAM logo image still has its blue–violet gradient (asset, not a token).

## Layout and spacing

- **Adaptive (D-008):** phones `< 600px` (Tailwind `sm` and below) and tablets use the mobile layout; desktop from `lg` (1024px) adds the sidebar. Breakpoint-specific differences are listed per screen.
- **Phone:** page padding 12–16px; white top bar (back · title · action); bottom nav (หน้าแรก · ติดตามงาน · **สแกน** solid blue raised circle · แจ้งเตือน · โปรไฟล์); primary actions in a sticky bottom footer.
- **Desktop:** sidebar 216–240px (logo, groups, active item `bg-secondary text-primary`), top bar 60–68px (breadcrumb, env tag, bell, user), content centred.
- **Spacing:** 4px base. Panel padding 20–24px (phone 15–16px). Gap between stacked panels 12–16px.
- **Touch targets ≥ 44px**, buttons 44–52px (primary actions at the bottom of a step 52–56px).

## Component usage

| Need | Use | Notes |
|---|---|---|
| Primary action | `Button` default (`bg-primary`), `rounded-sm` | One per area |
| Secondary | `Button` outline | White, `border-input` |
| Text action | `Button` link | |
| Panel | `Card` white, `border`, `rounded-xl`, `shadow-card` | No coloured backgrounds on plain panels |
| Status badge | `Badge` + leading dot: `bg-status-*/10 text-status-*` | Never colour alone; labels from `02-flows.md` |
| **Next-action card** (S07, CR-009) | Soft violet panel (`bg-violet/8`, border `violet/20`), white icon box, violet primary button; soft green when closed | Only for "what to do now" |
| Priority | pill badge `bg-priority-*/10 text-priority-*` + dot + label | Shown read-only with its reason (CR-008) |
| Choice cards (category, building, recent place) | button with icon box, title, one helper line, radio circle; selected = `border-primary ring-1 ring-primary bg-secondary/60` | Radix radio-group semantics |
| Multiple choice (symptoms) | check rows / chips with native checkbox (`accent-primary`) | Selected row tinted `bg-secondary/60` |
| Floor | row of number buttons (wraps), selected = solid primary | |
| Step wizard (S03) | progress strip (`ขั้นตอน n จาก m` + segments) + one step panel + sticky footer (ย้อนกลับ · ถัดไป) | Back never loses data |
| Review | report card: header (icon + category + title) + rows (label · value · แก้ไข) | Always visible before submit |
| Timeline (S07, CR-009) | 5 stages แจ้งงาน · รับเรื่อง · กำลังดำเนินการ · (ส่งกลับให้แก้) · เสร็จ · ประเมินตรวจงาน; 20px markers (done green check, current violet ring, later grey); `สิ่งที่ต้องทำต่อ` box; full history in a dialog | Sticky right column on desktop |
| Dialog / sheet | `Dialog` desktop, bottom `Sheet` look on phones, `rounded-xl` | |
| Stars | 5 buttons, empty by default, filled `#E09B0C`-like warning tone via token `--warning`/gold utility | Never preselect a score |
| Pickers / filters (CR-002) | `ChoiceField`, `Picker`, `FilterPill`, segmented control | Rules below, radius now 8px |
| Notifications, role switcher, mascot | unchanged components, restyled by tokens | Role switcher never in production |
| Icons | `lucide-react`, stroke 2, 20px (16 small) | |

## Patterns

- **Empty / error / forbidden / loading:** as before (mascot on empty / forbidden, inline `Alert` for partial failures, skeletons shaped like the final layout), restyled by tokens.
- **Forms:** label above the field (15 / 600), required `*` in destructive, hint below in muted; errors below the field with an icon; validate the current step on "ถัดไป", everything on the final submit, focus the first invalid field.
- **Pickers (CR-002):** unchanged rules — ≤ 5 options pills / radio cards, 6–12 grid, > 12 `Picker` (menu under the trigger on desktop, bottom sheet on phones, search when > 10); selected ≠ highlighted; `FilterPill` "ชื่อ: ค่า" with clear.
- **Draft:** long forms keep a local draft per user and say so when restoring.
- **Success:** white card, mascot, ticket number + copy, what happens next, primary "ดูงานนี้".

## Do / Don't

- **Do:** stack content top to bottom · one blue primary action per area · solid status colour only for the current state / action · pair colour with text · keep secondary text at `muted-foreground` or darker · realistic Thai copy from the screen specs.
- **Don't:** gradient headers or buttons · side-by-side columns inside a form step (S07 may use a facts | progress layout on desktop, CR-009) · hide the review before submit · preselect a rating · hex or arbitrary values in components (tokens only) · a dark theme · the role switcher in production.
