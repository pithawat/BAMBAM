# CR-001 — Administration settings design review

Status: APPROVED (2026-10-26) — owner: "ให้ทำ CR001 ตามแบบที่ออกแบบมา". Applied to the source specs (`../screens/`); intentional differences are listed in `../HANDOFF.md`.
Scope: [CR-001](../../changes/CR-001.md), revised by [CR-002](../../changes/CR-002.md), both authorized 2026-10-26. CR-002 governs the current prototype.

Mascot update: [CR-003](../../changes/CR-003.md), authorized 2026-10-26. Two newly generated transparent BAM tiger poses appear beside the page title: facility planner for Admin, access guardian for Superadmin. Decorative, static, 112px desktop / 72px mobile. [Assets and final prompts](CR-003-mascots.md).

## Open the prototype

Open [CR-001-admin-settings.html](CR-001-admin-settings.html) directly in a browser. No server, login, or database is needed. Keep its CSS, JavaScript, and `CR-001-assets/` beside the HTML. There are no top bars, logo, tenant block, notification bell or account avatar in the shell. (CR-002)

Alternatively, from the repository root:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory .
```

Open `http://127.0.0.1:4173/docs/modules/settings/ui/mockups/CR-001-admin-settings.html`.

- Default: Superadmin, users screen. Optional review controls are collapsed under "มุมมองตัวอย่าง" at the bottom of the sidebar. URL parameters also select `viewer=admin` and `state=loading|empty|error|forbidden`; use `tab=types#places` to open equipment types. (CR-002)
- Sidebar sections: `#users`, `#roles`, `#places`, `#categories`.
- Direct access example: `CR-001-admin-settings.html?viewer=admin#users` shows forbidden without rendering protected data.
- Edits live in browser memory and reset on a full reload. All people are fictional, using `example.com` emails.
- Home/repair service links open the existing application on port 3000. Booking services retain their upcoming state.

## Reference interpretation

- `web ui style/manage user.png`: white bordered panels, calm gray canvas, modest radius/shadow, blue selected menu and role controls, separated people rows and initials avatars.
- `web ui style/matrix permission.png`: one table per permission group, roles as rows and actions as columns; centered checkboxes and quiet headers.
- BAMBAM adaptation: Thai Anuphan typography, blue actions, existing priority colors, RMC SSO identity and project vocabulary. No reference-brand assets, invitations, passwords, account deletion or invented activation states. The owner removed the logo/CPAC block in CR-002.
- Anuphan Thai/Latin subsets are copied from the project's existing Next font cache; the prototype no longer depends on `.next`.

## Navigation and access

| Area | Admin | Superadmin |
|---|---|---|
| Buildings and rooms | Rename existing records | Rename existing records |
| Floor/room structure | Read from the building plan | Read from the building plan |
| Equipment types | Add/edit | Add/edit |
| Assets in rooms | Manage | Manage |
| Categories, symptoms, symptom priority | Manage | Manage |
| Roles and permissions | Hidden; direct access forbidden | Manage |
| Users and user roles | Hidden; direct access forbidden | Manage |

Desktop administration uses a quiet 232px white sidebar and starts directly with the page title. Navigation has no card frames, and there is no top header. One main working panel carries the task; context/location controls are visually subdued. Below 1024px the sidebar becomes a drawer opened beside the page title, with focus trapping and background controls made inert. Below 768px, people rows become cards and matrices become switches for one selected role. Phone forms use bottom sheets. (CR-002)

This proposal covers administration navigation. Employee service navigation and the unrequested audit/contractor-type screens retain their existing rules.

## Screen behavior

| Screen | Layout | Demonstrated interactions |
|---|---|---|
| S25 Users | One people panel with search/filter controls; contextual blue role control | Search name/code/email, role filter, pagination, details/history, old/new role confirmation, Superadmin warning, system/self role locking |
| S24 Roles/permissions | Permission and role-list tabs; grouped matrices | Toggle/revert/count changes, confirmation grouped by role, unsaved navigation guard, add/copy/edit roles, block deletion of roles with users |
| S20/S21 Buildings/assets | Subdued plan-location navigator beside the selected room's main asset panel | Rename building/room without changing IDs; add/edit/move assets, search/type filters, case-insensitive code uniqueness, deactivate/reactivate, room binding (CR-002) |
| Equipment types | Separate tab within Buildings/assets; one master list | Add/edit type name/icon; new type immediately selectable; inline type creation preserves the pending asset form; reject duplicate names (CR-002) |
| S22 Categories/symptoms | Category navigator and symptoms with priority labels | Add/edit category/icon/default priority, add/edit symptoms and priority, deactivate/reactivate, last-active-symptom warning |

Preserved policies:

- Every role can report/follow its own tickets and receive notifications; baseline actions are stated rather than silently made editable.
- Superadmin has every permission and cannot be switched off. Settings permissions show the owner's fixed Admin/Superadmin boundary. Copying a custom role does not grant administration.
- Priority derives from symptoms when reporting: highest selected priority wins, category default covers an other-symptom report; no ticket-level override.
- Assets belong to one room; building/floor derive from it. Structure comes from the plan. There are no add-building/floor/room or edit-floor actions in this settings prototype; building and room names can be edited while preserving IDs and attached equipment. (CR-002)
- Identity comes from SSO. No user invitation, deletion, password or invented activation-state controls.

## Verification

Using the already installed frontend Playwright dependency, run from the repository root:

```powershell
node docs/modules/settings/ui/mockups/CR-001-check.cjs
```

2026-10-26, CR-002 revision: **PASS**, nine behavior groups, zero browser JavaScript errors. Checked user search/filter/pagination/role confirmation; matrix changes/reversion/confirmation/navigation guard; role copying; plan-only location structure and rename identity preservation; equipment-type creation/selection/duplicate names/inline draft retention; duplicate asset codes and room binding; symptom urgency and final-symptom warning; Admin hidden navigation and direct-access denial; all four pages plus the equipment-types tab at 1280px/375px without page-level horizontal overflow; drawer/Escape/mobile switches; every state example. Screenshots also use 1440px desktop.

Screenshots: [Users](CR-001-assets/users-desktop.png), [permissions](CR-001-assets/roles-desktop.png), [buildings/assets](CR-001-assets/places-desktop.png), [categories/symptoms](CR-001-assets/categories-desktop.png), [Admin](CR-001-assets/admin-desktop.png), and corresponding `*-mobile.png` files.

CR-002 additions: [equipment types](CR-001-assets/asset-types-desktop.png), [type form](CR-001-assets/asset-type-form-desktop.png), [mobile types](CR-001-assets/asset-types-mobile.png).

## Implementation handoff / gaps

- This is a visual/interaction proposal. Browser guards and memory edits are demonstrations; real authorization, concurrency handling and persistence require server implementation during preparation/wiring.
- Approved sources have not been silently rewritten. After screen review, coordinate CR updates to screens/flows/plan/contract, final permission keys/seeds, shared-shell ownership and existing platform asset APIs before product work.
- Location creation is removed by CR-002. Plan editing/import supplies the structure; this UI only renames existing building/room labels.
- Final equipment-type API, code-prefix/mount metadata and 3D representation require preparation against the existing asset platform. This prototype uses a generic icon by default for new types.
- Reordering and deletion of unused category/symptom records are outside this focused prototype; retain their approved rules during preparation.
- State examples simulate failures; they do not implement API/version conflicts. The empty Role example concerns custom roles; system roles remain present.
- Application lint/build/e2e were not run: no product logic changed. Shared application code touched: none; CR-003 adds PNG/WebP mascot assets in `frontend/public/brand`. Prototype QA also verifies loaded images and the correct pose per viewer.
