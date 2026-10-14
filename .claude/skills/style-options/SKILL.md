---
name: style-options
description: Phase P2 — turn the style brief and real reference screenshots into three clickable style options, then write the design system once the user picks one. Once per project.
disable-model-invocation: true
---

Phase P2 Style. Once per project. No application code.

Read: `docs/shared/style/brief.md`, **every** file in `docs/shared/style/references/` (open each image), `docs/PROJECT.md` (locale, devices, NFRs), and the personas in the `01-users.md` of the module that owns the key screen named in the brief. If the `frontend-design` skill is available, apply it.

## Real-data rules

- Every statement about a reference app must come from its screenshot or a URL you actually fetched. If a reference in the brief has neither, ask the user for a screenshot. Never describe an app from memory.
- Mockup content uses realistic Thai data from the brief, attachments and glossary. No lorem ipsum, no placeholder names.

## Step 1 — reflect (Thai, ≤10 lines)

What you take from each reference (cite the filename), what the brief asks for, and three directions that differ meaningfully — density, color strategy, shape language — not just hue.

## Step 2 — build `docs/shared/style/options/`

- `option-a.html`, `option-b.html`, `option-c.html`, each self-contained (inline CSS; the only external resource is Google Fonts). Each shows:
  1. the key screen at 375px and 1280px side by side, with realistic data and at least one non-happy state (empty or error);
  2. a style tile: palette with token names, type scale in Thai + Latin, buttons (all variants + disabled), input with error, badges, card, table row, empty state.
- Define colors in `:root` using **shadcn/ui variable names** (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, plus `--success` / `--warning` if needed) so values transfer 1:1 to `globals.css`.
- Fonts must include the Thai subset on Google Fonts. Body text contrast ≥ 4.5:1.
- `index.html`: the three options with a two-line description each and links to open them.

## Step 3 — choose

Ask the user to open `options/index.html` and pick or mix ("สีของ A + ความแน่นของ C"). Iterate on the chosen file.

## Step 4 — write the design system

On approval, fill `docs/shared/design-system.md` completely: direction, typography (next/font/google family names and weights), the full token block, layout and density, component usage table, patterns, do/don't. Set `Status: APPROVED (YYYY-MM-DD)`, add a `D-###` line to `docs/DECISIONS.md`. If `frontend/src/app/globals.css` already exists, apply the tokens there too.

Next step for the user: `/ui-spec <module_key>`.
