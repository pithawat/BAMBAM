# Frontend rules — Next.js 16 + TypeScript + shadcn/ui

<!-- Reusable for any project on this stack. Project facts → docs/PROJECT.md -->

## Versions — don't code from memory

- Check `package.json` for exact versions before using an API you are not sure about.
- Next.js 16 changes that break older patterns:
  - `middleware.ts` is replaced by **`proxy.ts`**, exporting a function named `proxy`. Do not create `middleware.ts`.
  - `params` and `searchParams` are async — `await` them.
  - Turbopack is the default bundler.
- When unsure, check the official docs (nextjs.org/docs, ui.shadcn.com) rather than guessing.

## Layout

```
frontend/src/
├── proxy.ts                        auth gate (see docs/shared/integrations/sso.md)
├── app/
│   ├── layout.tsx                  fonts via next/font/google, providers
│   ├── globals.css                 theme tokens (shadcn CSS variables) — values from docs/shared/design-system.md
│   ├── (auth)/login/
│   └── (app)/<module>/…            module routes inside the shared app shell
├── components/
│   ├── ui/                         shadcn generated — add with `npx shadcn@latest add <name>`; don't hand-edit
│   └── shared/                     AppShell, PageHeader, EmptyState, ErrorState, ForbiddenState, …
├── modules/<m>/
│   ├── components/                 module UI                         (Codex owns during a stage)
│   ├── types.ts                    mirrors 04-api-contract.md        (Claude owns)
│   ├── mocks.ts                    realistic mock data               (Claude owns)
│   └── api.ts                      typed client; returns mocks when NEXT_PUBLIC_USE_MOCKS=true (Claude owns)
└── lib/
    ├── env.ts                      typed + validated env access (zod)
    └── http.ts                     fetch wrapper: base URL, credentials, error envelope → typed error

frontend/e2e/<m>/<flow-id>.spec.ts  Playwright, one file per flow ID (e.g. F01-receive-goods.spec.ts)
```

## Rules

- Server Components by default. Add `"use client"` only for interactivity.
- Data access only through `modules/<m>/api.ts`. Components never call `fetch` directly.
- Styling: Tailwind classes mapped to tokens (`bg-primary`, `text-muted-foreground`, `rounded-lg`). **No hex colors, no arbitrary values** unless the screen spec says so.
- Use shadcn components before writing custom ones. Variants go through the component's `cva` variants, not ad-hoc classes.
- Fonts: `next/font/google` in `app/layout.tsx`, with a font that supports Thai (as chosen in design-system.md).
- Every screen: loading (`loading.tsx` / skeleton), empty, error (`error.tsx`), forbidden. Copy comes from the screen spec.
- Forms: shadcn form components + zod schemas; field error messages from the screen spec.
- Accessibility: every input has a label, visible focus, touch targets ≥ 44px, color is never the only signal.
- Dates shown in `Asia/Bangkok`, formatted as `docs/PROJECT.md` specifies.

## Environments

```
.env.development     committed, non-secret dev values (localhost URLs, NEXT_PUBLIC_USE_MOCKS)
.env.production      committed, non-secret prod values (public URLs)
.env.local           secrets, never committed
```

- `NEXT_PUBLIC_*` is inlined at **build time** → the production build must run with production env. Never put secrets in `NEXT_PUBLIC_*`.
- Never branch UI logic on environment; only config values differ.

## Commands

```
npm run dev          # next dev
npm run lint
npm run typecheck    # tsc --noEmit
npm run build
npm run test:e2e     # playwright test
```
