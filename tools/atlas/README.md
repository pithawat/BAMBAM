# System Atlas

A living map of a project, opened in the browser from the repo:

| Tab | What it shows | Who it is for |
|---|---|---|
| ภาพรวม | modules, roles, permission matrix, the main path as a swimlane | everyone |
| Flow | every flow as a swimlane (one column per actor); finished flows run on the real app | team, UAT testers |
| ฟีเจอร์ & สถานะ | every feature with stage, status, e2e result and per-page notes | team, reviewers |
| ฟีเจอร์ทั้งหมด | the same features without status, filtered by role | users before UAT, handover docs |
| Timeline | stages as a stepper; dates only for accepted stages; change requests on the line | owner, team |

**Run on the real app.** A flow can be run only when every stage it belongs to is accepted and it has a
tour. "▶ รันบนแอพจริง" opens a browser-like popup on the Atlas page that shows a Playwright-driven Chromium
live: a caption box sits in the corner, form fields type themselves, the next thing to press is ringed,
and the tester presses **Space** (or clicks the picture) to go on. Testers can also start from any step
(click a box with a ▶ badge); earlier steps run on their own first.

| Run mode | How | Browser |
|---|---|---|
| popup (default) | "▶ รันบนแอพจริง", ▶ badges, "เริ่มจากขั้นนี้" | headless Chromium streamed into the Atlas page (CDP screencast over server-sent events); closing the popup or the tab stops it |
| separate window | "เปิดในหน้าต่างแยก" | headed Chromium window on the same machine; Space / click inside that window |
| verify | `cli verify` | headless, no waiting, nothing saved — checks every tour still passes; a failing step's screenshot goes to the OS temp folder |

The engine (`tools/atlas/`) knows nothing about the project. A project supplies two things:
`atlas.config.mjs` at its root and a data folder (default `docs/atlas/`). The UI is the same everywhere.

## Run it

```bash
# the app under test must be running (dev or UAT) with demo users available
node tools/atlas/cli.mjs serve          # → http://127.0.0.1:4400
node tools/atlas/cli.mjs check          # validate the data
node tools/atlas/cli.mjs verify         # headless run of every runnable tour: does it still pass?
node tools/atlas/cli.mjs verify repair/F23
node tools/atlas/cli.mjs export         # one small HTML file (data only) to share; no runner
```

No screenshots are stored: runs are watched live. Headless runs use Chrome's new headless (`channel: "chromium"`) so WebGL keeps the GPU — the old headless shell renders 3D in software at ~2 fps.

Node ≥ 20. No dependencies of its own: it loads Playwright from `playwrightFrom` (the project's e2e
install) or from `tools/atlas/node_modules`.

| Mode | Where | Runs the app | Notes saved to |
|---|---|---|---|
| `serve` | a machine that can reach the app | yes (popup or separate window) | `<dataDir>/notes.json` in git |
| `export` file | anyone (UAT, owner) | no — diagrams, features, timeline, UAT steps | the viewer's browser only |

**Test data.** Point Atlas at a test stack, not the dev servers: tours log in, create and change data. With
`stack` in the config, Atlas starts that stack on the first run (or reuses it) and stops what it started on
exit. BAMBAM shares one definition with Playwright e2e (`frontend/e2e/test-stack.cjs`): docker Postgres
database `bambam_e2e`, API :8090, web :3100. Data a tour creates stays in that database (sessions expire;
records that cannot be deleted, like deactivated equipment, accumulate there, never in the dev database).

**Safety.** The server listens on 127.0.0.1 only and refuses write requests from other origins. The
runner drives only hosts listed in `allowHosts`. Sessions come from `config.session(role)`, which must
use dev/UAT demo users — never real accounts, never production. Tours that create data must use unique
values (`{{run}}`) and clean up after themselves (see F31: add → move → undo → deactivate).

## Add Atlas to another project

1. Copy `tools/atlas/` as is. Do not edit it per project — fix bugs upstream and copy again.
2. Copy `tools/atlas/template/atlas.config.mjs` to the project root and fill in `baseURL`, `session(role)` and
   (recommended) `stack` — ideally the same test stack your e2e uses.
3. Copy `tools/atlas/template/data/` to `docs/atlas/` and replace the example with the project's modules.
4. Copy `tools/atlas/skill/SKILL.md` to `.claude/skills/atlas/SKILL.md` so Claude can keep the data in sync.
5. Add to `.gitignore`: `docs/atlas/dist/`.
6. `node tools/atlas/cli.mjs check`, then `serve`.

`session(role)` is the only project-specific code. It returns Playwright cookies for a demo user of
that role, for example by calling a backend CLI that mints a dev session (BAMBAM:
`go run ./cmd/devsession -role <role>`), or by logging in through a test-only form.

## Data

See [SPEC.md](SPEC.md) for every field. In short:

```
docs/atlas/
  project.json          name, theme, actors (swimlane columns), session roles, module list
  modules/<key>.json    roles, matrix, lifecycle, stages, change requests, features, flows (+ tours)
  notes.json            notes written from the UI, by module → feature
  dist/atlas.html       output of `export` (git-ignored)
```

The data mirrors the project's approved documents (users, flows, plan, progress). It is written and
updated by Claude with the `/atlas` skill, not invented: a stage is `accepted` only after the owner
accepted it, and only accepted stages carry a date.
