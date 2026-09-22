# Phase 04 Implementation Report — Clients + Executors

Date: 2026-09-15  
Baseline: Phase 03 Dashboard + Applications  
Status: implemented; local visual acceptance pending

## Pre-flight conclusion

The previous Clients/Executors implementation reused one `CrmDirectory` component, but the selected side area was mostly a static preview: tab labels were not interactive, useful CRM totals were hidden below the main workspace during editing, the executor list did not expose real workload/cost context, and legacy directory/detail styles still contained Light/Dark literals. The owner's Phase 03 screenshot feedback also explicitly deferred the client-side low-contrast/detail composition problem to Phase 04.

The backend already contains enough real data to build the requested workspace without schema or API changes:

- companies + representatives;
- client CRM summary with order count, active orders, revenue, debt and recent orders;
- executor directions;
- executor CRM summary with assignments, works, accrued/paid/owed totals;
- company/executor activity;
- existing order-work endpoints for real language pairs.

## What changed

### Shared Clients/Executors workspace

- Rebuilt `CrmDirectory` around a compact list + selected detail/editor split workspace.
- The list no longer shows only identity/contact/status. It consumes existing per-record CRM summaries to expose real operational context.
- Row selection is keyboard-accessible with Enter/Space and a visible focus state.
- Search/archive remain compact and grid-aligned; executor language/specialization filters remain available.
- The create/edit form now occupies the same right workspace instead of appending a second long page below the directory.

### Clients

- List columns now show contacts, real order count/active count, revenue/debt and status.
- Selected client has interactive `Обзор / Контакты / Заказы / История` tabs.
- Overview shows real type, email, phone, INN, order totals, revenue, debt and internal note.
- Language pairs are derived only from real works of recent client orders using the existing order-work API.
- Contacts tab reuses the existing representative CRUD so create/edit/archive functionality is preserved.
- Orders tab links to real orders; History tab reads real company activity.
- No client tags were fabricated because the backend has no tag model.

### Executors

- List columns now show real directions/specializations, active/completed workload and amount owed.
- Selected executor has interactive `Обзор / Направления / Работы / История` tabs.
- Directions use the real executor-direction records.
- Works use real executor assignments from the CRM summary, including assignment rate, accrued cost, deadline and status, with links to the related order.
- Overview shows real accrued/owed totals, contacts, specializations and internal note.
- No rating, experience, fake capacity percentage or default rate was introduced.

### Responsive / Dark

- Added a Phase 04 page-owned stylesheet using only existing semantic `--crm-*` / shared UI tokens.
- Desktop keeps the operational list and sticky detail side-by-side.
- At <=900 px the detail/editor becomes a single-column context above the list.
- At <=620 px the selected detail/editor becomes a full working surface below the topbar.
- The internal table remains horizontally controlled inside its own surface rather than widening the document.
- No page-specific Dark navy/blue literal text was added.

## Deliberately not changed

- No backend/API/database/Alembic changes.
- No order commandbar, Table/Kanban or order-card redesign (Phase 05).
- No Files/Users/Settings redesign (Phase 06).
- No product-wide Dark sweep (Phase 07).
- No new public-site-style motion system (Phase 08).
- No fake client tags, executor ratings, experience, capacity percentages or default rates.

## Targeted regression specification

Added `e2e/phase4-clients-executors.spec.ts` covering:

- client list uses real order/revenue/debt summary data;
- client detail tabs switch real contacts/orders/history panels;
- client language pair is derived from a real order work;
- executor list uses real workload/owed data;
- executor detail uses real directions and assignment rate/cost;
- Dark selected detail is not a white island and core text contrast remains >=4.5:1;
- Clients/Executors do not introduce document-level horizontal overflow at 900 / 620 / 430 / 390 / 360 / 320 px.

## Verification in this environment

Completed:

- `node apps/admin-web/scripts/audit-frontend-foundation.mjs`: foundation imported last, no missing required tokens, no reported semantic contrast failure below 4.5:1; Light primary 17.62 / secondary 5.05 / muted 4.51 / accent 4.52; Dark primary 16.25 / secondary 11.02 / muted 6.36 / accent 5.49;
- TypeScript `transpileModule` parser diagnostics for `crm-directory.tsx`, `phase4-clients-executors.spec.ts` and `layout.tsx`: **0 errors**;
- `tinycss2` parser validation for every CSS file under `src/app`: **0 parser errors**;
- canonical `crm-foundation.css` remains the final CSS import;
- root CSS `!important` count remains **35**, matching the Phase 03 baseline; Phase 04 stylesheet adds **0**;
- Phase 04 stylesheet adds **0 literal hex colors** and consumes only existing semantic tokens.

Not claimed as passed in this container:

- full `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- Playwright runtime execution.

`npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` was attempted but the dependency-install step timed out in the container. The partial `node_modules` directory was removed before packaging. Docker CLI is unavailable in this execution environment.

## Local acceptance commands

From the extracted project root:

```powershell
docker compose build frontend
docker compose up -d frontend

docker compose ps
docker compose logs --tail=100 frontend
```

Full frontend gate:

```powershell
cd .\apps\admin-web

npm ci
npm run audit:foundation
npm run typecheck
npm run lint
npm run build
npx playwright test e2e/phase1-shell.spec.ts e2e/phase2-ui-kit.spec.ts e2e/phase3-dashboard-applications.spec.ts e2e/phase4-clients-executors.spec.ts
```

No migrations are required for Phase 04. Do not use `docker compose down -v` for this frontend phase.
