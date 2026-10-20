# Facility dashboard prototype

Delivered file: `../../แผนผังงานซ่อมอาคาร.html`.
The file contains all application CSS and JavaScript. The original three.js 0.160.0
imports remain on jsDelivr; the three requested font families load from Google Fonts.
`original.html` is the unchanged source backup.

## Scope

- Standalone redesign requested on 2026-10-19, using the supplied reference image.
- Original building geometry, floor plans and all 12 JOBS are retained.
- Added sample category, creation, acceptance, start and completion timestamps.
  The drawer labels the synthetic history; original update text stays unchanged.
- One filter state drives KPI scope, charts, context panels, table and 3D status pins.
- KPI counts use the other filters while showing every status for comparison.
- Pending jobs precede in-progress jobs, then creation time ascending. No new
  business priority or SLA policy is inferred from the symptoms.
- Only October has data. Empty months are shown without invented historical jobs.
- Status colors are reserved for pending / in-progress / done. Change indicators,
  connectivity copy and the notification marker use neutral/accent styling.
- This is a local sample dataset, so the top bar does not claim a live sync.
- No backend, application module, approved flow, plan or API contract was changed.
- Added local asset registration from the 3D card and Equipment menu: four existing
  asset types (aircon, microphone, speaker, tv), suggested unique code, name,
  building, floor, room, and a clickable plan with keyboard-editable coordinates.
  Room bounds and case-insensitive code uniqueness are validated. Assets persist
  under `facility-demo.assets.v1` in localStorage and appear as accent square markers
  on the 3D floor. Adding an asset does not create or change repair tickets.

## Demo

Open the delivered HTML in a browser with network access and WebGL, or run from
the repository root:

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

Visit `http://127.0.0.1:8766/แผนผังงานซ่อมอาคาร.html`. No account is required.
Try pending KPI, an equipment category, a ranking bar, and a table row. Close the
drawer to see the selected floor. Test CSV export, dark mode, and the mobile sheet.

## Verification

```powershell
node output/facility-redesign/contrast.cjs
$env:QA_ONLINE='1'
node output/facility-redesign/qa.cjs
node output/facility-redesign/assets-qa.cjs
node --check output/facility-redesign/model-check.mjs
```

Playwright uses the repository's existing frontend installation. The local HTTP
server above must be running. Omit `QA_ONLINE` for an offline UI run. `qa.cjs`
generates screenshots, a CSV export check and a temporary module syntax file.

Validated: WebGL initialization, KPI/category/building/month/search filters,
ranking-to-floor navigation, filtered pins, pin/table-to-drawer selection, timeline,
Escape dismissal, empty charts, sorting, CSV, themes and responsive widths
360 / 390 / 768 / 1024 / 1280 / 1512. Theme text token pairs pass WCAG 4.5:1
(minimum measured 4.61:1). No runtime JavaScript errors in the walkthrough.
Asset checks cover required fields, malformed/duplicate codes, room bounds,
point selection, save and reload, marker details, storage quota failure without
losing form data, mobile creation, and preservation of the original 12 tickets.

Limitations: no live backend or permissions, history times are sample data,
external network is needed for three.js/fonts, and only building 1 floor 1 has the
original detailed room plan. Missing floor plans and sample buildings are labeled.
Added assets are browser-local; clearing site data removes them and they are not
shared across devices. Asset registration uses the model's available room shapes.
