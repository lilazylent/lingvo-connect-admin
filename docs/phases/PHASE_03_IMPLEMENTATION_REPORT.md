# Phase 03 Implementation Report — Dashboard + Applications

Date: 2026-09-15  
Baseline: Phase 02 Shared UI Kit  
Status: implemented; local visual acceptance pending

## Owner feedback resolved in this phase

The owner reviewed the local Dark-theme build and supplied screenshots plus the public Lingvo Connect website video. Phase ownership was resolved before changing code:

- Dashboard / Applications page-specific Dark palette problems are **Phase 03 defects** and were fixed now.
- The login `Продолжить` button touching the password field is a shared geometry regression and was fixed now.
- Applications preview `Информация / Контакты / Файлы` is Phase 03 and is now interactive.
- Clients full workspace redesign remains Phase 04; semantic detail-panel fixes made in Phase 03 are allowed to improve it without changing its composition.
- Orders `Архив` + `Таблица / Kanban` dead-space/command layout remains Phase 05 and was deliberately not redesigned here.
- The exhaustive all-route Dark audit remains Phase 07.
- Public-site-inspired premium motion/EFX remains Phase 08.

The exact mapping is preserved in `docs/OWNER_FEEDBACK_PHASE_MAP_2026-09-15.md`.

## What changed

### Dashboard

- Converted the Dashboard KPI cards, finance strip, compact tables, quick actions and system card from page-specific light literals to the canonical semantic `--crm-*` palette.
- Dark secondary quick actions no longer render as white islands; they use raised/hover graphite surfaces.
- Dashboard compact-table primary, secondary and muted copy now uses semantic text roles instead of old navy literals.
- Increased operational microcopy sizes where the previous values were unnecessarily small.
- Metric tone colors now use shared semantic accent/info/warning/success/violet roles instead of a second local palette.
- Preserved the existing real dashboard API values and the master-reference composition; no fake KPI or notification state was added.

### Applications

- Replaced decorative preview tab labels with real `button[role=tab]` controls for `Информация`, `Контакты`, `Файлы`.
- Added real detail loading from the existing `/api/admin/applications/{id}` endpoint when a row is selected.
- `Контакты` now shows only real application contact data.
- `Файлы` now shows only real files from the application-detail response and links to the existing application-file download endpoint.
- Converted selected-panel labels, values, messages, selected-row state and panel surfaces to semantic Light/Dark colors.
- Added visible keyboard focus for the tab controls and explicit tab/tabpanel relationships.
- Raised tiny page-level supporting text to a more readable scale while keeping dense CRM composition.

### Auth regression

- Restored a deliberate grid gap between auth fields and the submit action.
- The login submit button now has its own spacing after the password control rather than visually touching it.

### Project continuity

- Preserved the owner's original 26-point specification verbatim at `docs/CRM_MVP_MASTER_SPEC_OWNER_ORIGINAL_26.txt`.
- Preserved the supplied public website motion reference at `docs/references/LINGVO_PUBLIC_SITE_MOTION_REFERENCE_2026-09-15.mp4` so later agents do not lose the EFX/brand reference.
- Added `docs/phases/PHASE_03_DASHBOARD_APPLICATIONS.md` and the owner feedback phase map.
- Updated `AGENTS.md` so future work cannot defer visible Phase 03 Dark defects to Phase 07 or forget the public-site reference.

## Deliberately not changed

- No backend, API contract, database, SQLAlchemy, Alembic, tariff, pricing, payment, RBAC or auth flow changes.
- No Clients / Executors composition redesign (Phase 04).
- No Orders / Kanban / order-card composition redesign (Phase 05).
- No Files / Users / Settings redesign (Phase 06).
- No global all-route Dark-theme sweep (Phase 07).
- No new decorative motion system (Phase 08).
- No fake business values or placeholder ratings were introduced.

## CSS consolidation / regression metrics

Compared with the delivered Phase 02 baseline:

- existing `!important` declarations: **35 -> 35** (no new declarations);
- literal color occurrences: **933 -> 858**;
- unique literal colors: **578 -> 529**;
- cross-file duplicate selectors: **534 -> 534**;
- canonical foundation remains the final CSS import.

The reduction comes from replacing Dashboard / Applications page-specific literals with Phase 0 semantic tokens instead of introducing another override stylesheet.

## Targeted regression specification

Added `e2e/phase3-dashboard-applications.spec.ts` covering:

- Dark Dashboard quick actions are not white islands;
- Dark Dashboard compact-row primary text meets a 4.5:1 contrast target;
- Applications selected preview exposes interactive tabs;
- Contacts and Files tabs use real API-backed data;
- Dark application-preview labels/values meet a 4.5:1 contrast target;
- login password-to-submit spacing is at least 8 px;
- Dashboard / Applications do not introduce document-level horizontal overflow at 900 / 620 / 430 / 390 / 360 / 320 px.

## Verification completed in this environment

Passed:

- `node apps/admin-web/scripts/audit-frontend-foundation.mjs`
  - foundation imported last: yes;
  - missing required tokens: none;
  - Light/Dark reported semantic contrast failures below 4.5: none;
  - dark primary 16.25, secondary 11.02, muted 6.36, accent-on-surface 5.49.
- CSS syntax parse with `tinycss2` for all CSS under `src/app`: **0 parser errors**.
- TypeScript parser diagnostics for `admin/applications/page.tsx` and `e2e/phase3-dashboard-applications.spec.ts`: **0 parser diagnostics**.
- Root CSS `!important` count remains **35**, matching the Phase 02 baseline.

Not claimed as passed in this container:

- full `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- Playwright runtime execution.

`npm ci --ignore-scripts --no-audit --no-fund` was attempted but the container dependency-install step timed out. It left only a partial unusable `node_modules`, which is removed before packaging. Docker CLI is unavailable in this execution environment. These runtime gates must therefore be run locally; they are not represented as successful here.

## Local acceptance commands

From the extracted project root in PowerShell:

```powershell
docker compose build frontend
docker compose up -d frontend

docker compose ps
docker compose logs --tail=100 frontend
```

For the full frontend gate outside Docker:

```powershell
cd .\apps\admin-web

npm ci
npm run audit:foundation
npm run typecheck
npm run lint
npm run build
npx playwright test e2e/phase1-shell.spec.ts e2e/phase2-ui-kit.spec.ts e2e/phase3-dashboard-applications.spec.ts
```

No migrations are required for Phase 03. Do not use `docker compose down -v` for this visual phase.
