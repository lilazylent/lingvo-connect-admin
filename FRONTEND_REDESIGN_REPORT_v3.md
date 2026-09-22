# Lingvo Connect Admin — Master Reference Frontend v3

## Goal
Replace the accumulated visual layer with a coherent frontend system based on the user-approved Minimal / Professional master reference, without changing backend contracts or CRM business logic.

## Visual foundation implemented
- Added the approved reference to `docs/MASTER_FRONTEND_REFERENCE.jpeg`.
- Added `src/app/master-reference.css` as the final frontend reference layer and semantic visual system.
- Rebuilt the application shell: brand, navigation, responsive off-canvas sidebar, sticky topbar, real global cross-module search, profile menu and consistent action controls.
- Removed mock operational UI from the shell: no hard-coded application count and no fake unread notification dot/action.
- Added reference-derived mountain/promo imagery under `public/reference-assets/`.
- Added a shared inline SVG icon system in `src/components/icons.tsx` so controls do not depend on mismatched emoji/browser glyphs.

## Modules restyled/recomposed
### Overview
- Reference page hero, six real dashboard metrics, real finance totals, recent orders/applications, quick actions and system card.
- Removed fabricated percentage deltas; displayed values are API-backed or static explanatory copy.

### Applications
- Reference hero and metric band with real filtered totals.
- Search/filter/table workspace and a real selected-application preview panel.
- Existing detail/create routes retained and visually normalized by the reference system.

### Clients / Executors
- Shared directory layout rebuilt around reference table + selected record detail composition.
- Existing API data, editor, summaries, contacts and history remain functional.

### Orders
- Reference page header and real order summary metrics added while preserving the existing full order workflow: list/Kanban, order card, works, pricing, multiple executors, payments, files and history.

### Files
- Reference file workspace with real summary/export/filter behavior, selectable file rows and detail side panel.
- Existing download/source links and backend registry remain unchanged.

### Users
- Reference metrics, user table and detail panel.
- Existing create/edit/password/2FA/access actions remain available.

### Settings
- Settings reorganized visually as reference module tiles while retaining the existing settings implementation/data.
- Modules labelled around actual CRM concepts: directories, tariffs, discounts/coefficients, order statuses, users/roles, appearance, services/units.

### Auth and supporting UI
- Login, recovery/change password and 2FA surfaces normalized to the same light professional system by shared CSS.
- Application detail/manual create, dialogs, controls, badges, status/empty/error/loading surfaces inherit the new system.

## Responsive behavior
- Desktop sidebar becomes off-canvas at <=1180 CSS px. This intentionally makes browser zoom 175–250% behave like tablet/mobile rather than crushing desktop columns.
- Additional breakpoints reflow dashboards, tables, split panes, form groups, toolbars and side panels.
- `prefers-reduced-motion` is respected.

## Theme behavior
- Light theme is the approved primary master.
- Dark theme is retained as a semantic graphite companion using the same component geometry, rather than a separate blue/teal redesign.

## Functional scope intentionally unchanged
No database schema, backend router, migration, tariff rule, order calculation, payment logic, executor assignment logic, file persistence, authentication or permission contract was changed in this frontend pass.

## Verification actually performed
- Parsed all 44 frontend `.ts/.tsx` source files with TypeScript `transpileModule`: 0 parser diagnostics.
- Parsed all frontend CSS files with `tinycss2`: 0 CSS parse errors.
- Audited the redesigned shell/dashboard for mock counters/percentages and removed the hard-coded examples discovered during review.

## Checks not claimed
A full `next build`, project TypeScript semantic typecheck, ESLint and Playwright visual/e2e suite were not completed in the working container. The supplied source archive did not contain installed frontend dependencies; an explicit `npm ci --offline --ignore-scripts` attempt failed with `ENOTCACHED` because `zod-validation-error-4.0.2.tgz` was not present in the local npm cache. Those checks must run in the user's normal Docker/local build before production deployment.
