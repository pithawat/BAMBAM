# Three-service navigation and repair UI — CR-010 / CR-011

Open `index.html` in a browser. No server or account is required. Keep this folder in its repository location so relative brand asset paths resolve.

The revised navigation follows `navbar.png`, with no navbar mascot and equal prominence for repair, car booking and room booking. Each service uses the same typography, icon treatment and navigation padding. Only the current destination has an active indicator. Car and room links lead to an unavailable-service preview without inventing booking workflows.

## Open the proposals

- `index.html`: neutral service hub and shared navbar.
- `repair-my.html`: revised general-user repair tracking from the owner's latest `myticket.png`. View tabs, pill filters, search and compact tables grouped by repair status replace the initial statistic-card layout. The latest visual refinement adds a small mascot beside the page title, pale status-colored group headings, stronger issue titles and a labeled review CTA. Collapse/expand each group, filter status/relation/date, sort within groups, then open a ticket and return with filters retained. Screen-specific styles are in `repair-my.css`.
- `ticket-detail.html`: issue/location/status/next action summary and vertical timeline inspired by `timeline.png`. Use preview controls to inspect steps, date changes, automatic/admin closure, reporter/subscriber views and exceptional states. Evaluation/send-back dialogs validate example input without submitting or changing any real record.

Existing application routes remain `/repair/my` and `/repair/tickets/[id]`; the user described these as `/repair/me` and `/repair/ticket/[ticketID]`. No routes were renamed.

Current screenshots: `services-{375,1440}.png`, `repair-my-{375,1440}.png`, `ticket-detail-{375,1440}.png`. The earlier `preview-{375,1440}.png` screenshots show the superseded first proposal and are retained only as historical artifacts.

## UX and visibility

The global shell has no service-specific CTA. Repair actions are local to repair screens. The list places awaiting-evaluation groups first and prioritizes the current reporter's review within that group. Default sorting is by update time within groups; creation-date sorting is also available. Group counts share search/relation/date/status filters, and the awaiting group includes followed resolved tickets; only the reporter receives evaluation actions. The prototype fixes sample date calculations to 18 October 2026.

General-user views exclude priority/source, queue ordering, contractor identity/contact/rating and internal management actions. Detail/history retain user-relevant progress and date-change reasons. This prototype does not change API field exposure or authorization. Actual permissions remain server-driven during implementation.

The timeline marks completed/current/future steps separately, includes rework and does not imply an evaluation occurred on automatic/admin closure. Missing evidence preserves the ticket summary. No real ticket photos were provided for these examples, so evidence areas explicitly show an empty state.

## Validation

Run from the repository root: `node output/navbar-redesign/check.cjs`.

Passed: all three pages at 375, 768, 1024 and 1440px; navigation and image checks; no horizontal page overflow; grouped-list counts, search, relation/status/date filters, chronological and creation-date sort, group collapse/expand by keyboard and pointer, return with filters; eight detail variants for two viewer relations at mobile and desktop widths; exceptional states, rating/send-back validation, keyboard selection and Escape focus restoration; no JavaScript runtime errors.

The previously generated mascot PNG in `frontend/public/brand/mascot-white-leopard-bust-v2.png` now appears as a small decorative companion beside the repair tracking page title, as requested by the owner. It never appears in the navbar. No new image was generated or edited for this refinement; generation details remain in `mascot-prompt.txt`. The proposals use locally cached Anuphan font files copied from the app build for offline preview.

No production source was changed, so application build/lint and authenticated e2e tests were not run. CR-010/CR-011 list the implementation acceptance checks still required. Staff tools, image lightboxes with real attachments and authenticated API actions must be checked during implementation; this review focuses on general users.
