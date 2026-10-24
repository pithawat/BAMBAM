# System Atlas — data spec

All files are JSON (UTF-8). User-facing text is in the project's UI language; keys and ids are not.
`node tools/atlas/cli.mjs check` validates everything below.

## atlas.config.mjs (project root)

| Field | Required | Meaning |
|---|---|---|
| `baseURL` | yes | the app under test, e.g. `http://localhost:3000` |
| `session(role)` | yes | returns Playwright cookies for a demo user of `role` (a key of `sessionRoles`). Called on the first step and on every role change. Runs with cwd = project root |
| `dataDir` | no | default `docs/atlas` |
| `port` | no | default `4400` |
| `stack` | no | `{ servers: [{ command, cwd, url, env, timeout }] }` — the app under test, started on the first run when `url` does not answer (reused when it does), stopped with Atlas. Same shape as Playwright `webServer`, so a project can share one definition with its e2e |
| `target` | no | one line naming where runs go (app, API, database without password); shown in the header and the run popup |
| `preflight()` | no | async check before every run, after the stack is up — throw to refuse (e.g. the API is not on the test database) |
| `allowHosts` | no | hosts the runner may drive; default `["localhost","127.0.0.1"]`. Never production |
| `playwrightFrom` | no | folder whose `node_modules` has `playwright` or `@playwright/test` |
| `browser` | no | `{ viewport, locale, timezoneId, args, captureArgs }` — `args` for the separate window; headless runs use `headlessChannel` (default `"chromium"` = new headless with GPU) + `headlessArgs`; `captureArgs` only if that channel is missing (old headless shell) |

## Server API (127.0.0.1 only; write routes refuse other origins)

| Route | Purpose |
|---|---|
| `GET /api/data` | project, modules, notes, meta, current run |
| `POST /api/run` `{ module, flow, from, mode: "embed" \| "live" }` | start a run (one at a time; only runnable flows) |
| `GET /api/run/stream` | server-sent events: `status` (JSON, carries the run `id`) and `frame` (base64 JPEG) |
| `GET /api/run` · `POST /api/run/next` · `POST /api/run/stop` | poll, advance, stop |
| `PUT /api/notes` | replace `notes.json` |

## project.json

```json
{
  "name": "BAMBAM",
  "summary": "…",
  "modules": ["repair"],
  "theme": { "primary": "#2741FA", "primaryDark": "#6B7FFF" },
  "actors": { "user": { "name": "พนักงาน", "lane": "ผู้แจ้ง / พนักงาน", "sub": "ทุก role", "color": "#2741FA", "dark": "#8C9BFF" } },
  "sessionRoles": { "employee": "พนักงาน" }
}
```

- `actors` — every swimlane column and every role chip. `name` = short label, `lane` / `sub` = column header,
  `color` / `dark` = lane colour in light / dark theme. Include `"all": { "name": "ทุก role" }` and non-human
  actors (system, external service).
- `sessionRoles` — roles the runner can log in as (keys passed to `session(role)`) → display name.

## modules/&lt;key&gt;.json

| Field | Meaning |
|---|---|
| `key`, `name`, `summary` | module identity |
| `sources` | the documents this file mirrors (for people and for `/atlas sync`) |
| `roleCount`, `roleNote` | headline number of roles and a one-line note |
| `overviewFlow` | id of the flow drawn on the overview tab (the main path) |
| `roles[]` | `{ actor, name, code, can[] }` — role cards |
| `matrix` | `{ cols: [actor], rows: [{ label, flows, cells: { actor: true \| "text" } }] }` — missing cell = no |
| `lifecycle` | `{ title, steps: [{ label, tone }], note }`; tone = `progress` `built` `attn` `accepted` `pending` |
| `stages[]` | see below |
| `crs[]` | `{ id, date, after, text }` — a change request drawn on the timeline after stage `after` |
| `features[]` | see below |
| `flows[]` | see below |

### stages[]

`{ id, short, name, status, date?, flows[], cr?, note? }`

- `status`: `accepted` (owner accepted) · `built` (done, waiting acceptance) · `progress` · `pending` · `replaced`.
- `date` (ISO `YYYY-MM-DD`) = acceptance date. **Only accepted stages have one.** No planned dates.
- `flows`: flow ids delivered (fully or partly) in this stage.

### features[]

`{ id, name, desc, flow, screens, roles[], stage, status, e2e, group }`

- `roles`: actor keys (`all` = every role). `e2e`: `pass` · `fail` · `none`. `group`: catalog heading.
- `desc` is written for end users (it appears in the status-free catalog).

### flows[]

```json
{ "id": "F23", "name": "…", "actors": ["admin"], "screens": ["S29"], "stages": ["3D"], "why": "…",
  "lanes": [{ "id": "admin", "slots": 2, "label": "…", "sub": "…" }, { "id": "sys" }],
  "nodes": [{ "i": "s", "l": "admin", "r": 0, "s": 0, "t": "start", "x": "line 1\nline 2", "ln": ["F22"] }],
  "edges": [{ "f": "s", "t": "a1", "lb": "ใช่", "dash": false, "m": "v", "lp": "last" }],
  "tour": { "aliases": {}, "steps": [] } }
```

- `stages` — optional; default = every stage whose `flows` lists this id. A flow's status is the lowest status
  among its stages. **Runnable = has a tour and every stage is `accepted`.**
- `lanes` — columns left to right; `slots` widens a column for side-by-side boxes; `label`/`sub` override the actor.
- `nodes` — `i` id · `l` lane · `r` row (0 = top) · `s` slot inside a wide lane (default centred) ·
  `t` type: `start` `act` `dec` (decision) `end` `link` (jump to flow `to`) `note` · `x` text (`\n` = new line) ·
  `ln` flow-id chips.
- `edges` — `f` → `t`; `lb` label; `dash`; `m` routing override: `v` (down, across, down) · `h` (across, then
  down) · `vr` (down, then into the side) · `loop` (back up on the right). Default: same row → `h`, upward →
  `loop`, from a decision to another column → `h`, else `v`. `lp: "last"` puts the label on the last segment.

### tour

```json
{ "from": { "spec": "frontend/e2e/repair/F23-dashboard.spec.ts", "tests": ["AC2: …"] },
  "aliases": { "card": { "css": "section[aria-label='อาคาร 1 แบบ 3 มิติ']" } },
  "steps": [{
    "node": "a2", "role": "admin", "becomes": null, "goto": "/",
    "title": "…", "desc": "…", "expect": "…",
    "do": [ { "waitFor": { "css": "canvas", "within": "@card" }, "timeout": 60000 } ],
    "highlight": { "role": "button", "name": "/^ชั้น 1 /", "within": "@card" },
    "next": null, "optional": false, "timeout": 30000, "skipped": "…"
  }] }
```

`from` (required) — the **passing** e2e spec and test titles the tour was written from. `check` fails when the spec
or a title is missing, or when any feature of the flow is not `e2e: "pass"`: tours come only from passing e2e.

One step = one Space press. The runner, for each step:

1. switches session if `role` differs from the current one (`session(role)`, then reload unless `goto`);
   `becomes` only records that the app itself changed the session (e.g. its own role switcher);
2. `goto`, then runs `do` actions (fields type visibly);
3. waits for `highlight`, rings it, shows `title` / `desc` / `expect`, and waits for Space or a click
   (`verify` mode: does not wait);
4. runs `next` — default: click `highlight`; `false`: nothing.

`optional: true` — if `highlight` does not appear within `timeout`, the caption says `skipped` and the step's
`next` is not run (use it for things that depend on data, like a pin that exists only when a ticket is open).

`node` is the box in this flow's swimlane the step belongs to; the UI rings it while the step runs and shows
"▶ 1–3" badges. `title`, `desc`, `expect` are also the UAT script on the flow page.

**Locators** — a string is `"@alias"` or a CSS selector. An object has one of `role` (+ `name`), `text`,
`label`, `testId`, `css`, `xpath` (e.g. `.//div[text()[1]='Room A']` = a div whose first text node is the name,
for labels that also hold a second line), plus optional `exact`, `hasText`, `within` (another locator), `nth`, `visible`.
Strings of the form `"/…/flags"` are regular expressions. `{{run}}` is a unique id per run (use it for
codes the tour creates). The first match is used unless `nth` is given.

**Actions** — `{ goto }` · `{ click, dispatch?, force? }` · `{ fill, text }` (types visibly) ·
`{ pick: combobox, option }` · `{ press: "Escape" }` · `{ drag: { from, to, dx?, dy?, at? } }` (`at: "below"` = drop `dy` px under `to`'s bottom edge) · `{ see: locator | "text" }` ·
`{ notSee }` · `{ waitFor, timeout? }` · `{ scrollTo }` · `{ wait: ms }`.

Write tours from the flow's passing e2e spec: same locators, same order, same test data rules.

## notes.json

`{ "<module>": { "<featureId>": [{ "t", "kind", "page", "by", "date", "done" }] } }` — written by the UI
(`PUT /api/notes`). `kind`: แก้ไข · คำถาม · ไอเดีย. Open notes are input for a change request; they are not one.
