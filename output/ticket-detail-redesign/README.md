# S07 visual proposal — CR-012

Open `index.html` in a browser. This standalone prototype reuses local styles,
fonts, shell and demo controls from `../navbar-redesign/`; keep both directories.
No server or API is needed.

Scope (revision 2): reference-based job facts, repair-outcome-first evidence,
blue timeline rail/markers and a neutral evaluation card/dialog for `/repair/tickets/[id]`.
Timeline typography matches the current `ticket-detail.tsx`: 13/20 timestamps,
16/24 stage headings, 14/22 descriptions and 12/20 current badge, all Anuphan.
The issue heading is separated from the reference-based job card. Evaluation
uses a white surface, empty stars and blue confirmation; a clicked star opens a
draft score, and submitting remains a separate explicit step. Text entry starts
with no rating. Followers never receive rating or send-back controls.

The preview controls demonstrate loading, missing photos, errors, forbidden,
not-found, reporter/follower and each lifecycle step. Gallery thumbnails,
lightbox arrows/Escape/focus return, history and review dialogs are local only.
Example artwork is reused from CR-008 `demo.js`, never real repair evidence.

Production implementation remains pending CR-012 approval. Do not infer stage
acceptance or new business rules from the sample data. S03/S06 are untouched.

Visual check: `node output/ticket-detail-redesign/check.cjs` from repo root.
