# Design system

Status: DRAFT

<!-- Written by Claude in /style-options after the user picks an option.
     Before approval this file is a template. After Stage 0, the token VALUES live in
     frontend/src/app/globals.css; this file stays the source for USAGE rules. -->

## Direction

- Chosen option: (A / B / C + adjustments) — see `style/options/`
- In one sentence:
- Taken from references: (file → what)

## Typography

| Role | Font (next/font/google) | Weight | Size / line-height |
|---|---|---|---|
| Body (Thai + Latin) | | | |
| Headings | | | |
| Numbers / code | | | |

## Tokens — paste into `frontend/src/app/globals.css`

```css
/* shadcn/ui variable names. Values filled in after approval. */
:root {
  --radius: ;
  --background: ;
  --foreground: ;
  --card: ;
  --card-foreground: ;
  --popover: ;
  --popover-foreground: ;
  --primary: ;
  --primary-foreground: ;
  --secondary: ;
  --secondary-foreground: ;
  --muted: ;
  --muted-foreground: ;
  --accent: ;
  --accent-foreground: ;
  --destructive: ;
  --border: ;
  --input: ;
  --ring: ;
  /* app-specific status colors, if needed */
  --success: ;
  --warning: ;
}
.dark { /* only if dark mode is in scope */ }
```

## Layout and spacing

- Container widths / breakpoints:
- Page padding mobile / desktop:
- Density: table row height, list item height, form field spacing:

## Component usage

| Need | Use | Notes |
|---|---|---|
| Primary action | `Button` default | max one per screen area |
| Data list (desktop) | `Table` | |
| Data list (mobile) | `Card` list | |
| Status | `Badge` + text | never color alone |
| Confirm destructive | `AlertDialog` | |
| Feedback | toast (`sonner`) | |

## Patterns

- Empty state:
- Error state:
- Loading:
- Forms (label position, required marker, error placement):

## Do / Don't

- Do:
- Don't:
