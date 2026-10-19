# ตั้งค่าระบบ (Superadmin) — Progress

<!-- The module's memory. Agents update it at the end of every task. Keep under ~60 lines. -->

**Phase:** P5 Build (ready)   **Stage:** 0 of 6   **Updated:** 2026-10-16

## Now

- P1 APPROVED 2026-10-16 (user: "ทำเลย"; Claude's proposals for the open questions accepted: S12 shows inactive floors until their tickets close, no user export this phase, audit kept forever)
- P3 drafted: `ui/screens/_common.md`, S19–S26 specs, mockups `S24-roles-permissions.html` (matrix after the user's sample `attachments/matrix-permission-reference.png`), `S20-buildings.html` (S20 + S21), `S25-users.html`; `ui/HANDOFF.md` with stages
- P4 drafted: `04-api-contract.md` (45 endpoints + P1–P3 changes, P8), `03-plan.md` (6 stages), decisions D-048–D-051
- Repair `changes/CR-007.md` PROPOSED (M): permission checks, shared buildings, contractor type re-activate, S12 floor plan
- **APPROVED 2026-10-16** (user: approve screens and plan, restyle to the new style in `web ui style/`): specs, `_common.md`, `03-plan.md`, `04-api-contract.md`, repair CR-007; D-048–D-051 final
- New style = repair CR-008 (PROPOSED); each settings stage restyles its mockup when prepared. S22 gains symptom priority + category default priority once CR-008 is approved (settings Stage 5)

## Next

1. `/build-stage settings 1 prepare` in a fresh session (Stage 1 = roles as data + permission checks + S19; S19 built in the CR-008 style if CR-008 is approved by then)

## Done (current stage)

-

## Open issues / questions

- First Superadmin employee code(s) for `SUPER_ADMIN_EMPLOYEE_CODES` per environment — before UAT (Stage 6)
- Repair Stage 1–2 still waiting for acceptance; settings Stage 1 refactors their permission checks (CR-007 A) — accept repair 1–2 first or together
- Shared dev DB rejects DDL (repair PROGRESS) — settings migrations need the same writable user
- Category icon set = 12 lucide icons (S22) — more on request
- Room booking will add room usage + its own permission group later

## Stage log

- P1 discovery drafted 2026-10-15 · approved 2026-10-16
- P3 UI spec + P4 plan drafted 2026-10-16 · approved 2026-10-16 (+CR-007, D-052)
