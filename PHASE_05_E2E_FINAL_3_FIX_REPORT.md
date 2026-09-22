# Phase 05 — E2E Final 3 Fix

Date: 2026-09-15
Baseline: `Lingvo_Connect_Admin_Phase_05_E2E_Regression_Fix_v1`

## Scope

The owner reran the Phase 1–5 targeted Playwright gate and reported 47 passed / 3 failed:

1. `phase2-ui-kit.spec.ts` — table/badge operational surface.
2. `phase2-ui-kit.spec.ts` — Dark semantic controls.
3. `phase3-dashboard-applications.spec.ts` — selected application tabs/files.

This patch addresses only those remaining regression contracts. Backend, API schema, database and migrations are unchanged.

## Changes

### Theme bootstrap is now observable

`CrmThemeLoader` marks `html[data-crm-theme-ready]` while loading the persisted preference and sets it to `true` only after the preference request settles. The Playwright helper waits for this contract before forcing Light/Dark. This removes the remaining race where a late preference callback could overwrite the test theme between assertion steps.

### Phase 2 operational-surface test follows design tokens

The test now verifies the actual table and badge radii against `--ui-radius-card` and `--ui-radius-round` instead of arbitrary numeric thresholds. Row hover verifies that no transform is introduced and allows a 0.5 px tolerance for browser subpixel layout while still asserting that hover does not resize the row.

The applications list response is explicitly awaited before shared table geometry is inspected.

### Applications detail has an explicit loading contract

`ApplicationPreview` now exposes `aria-busy` while its real detail request is pending. The Phase 3 test waits for the exact application-detail response and for `aria-busy="false"` before asserting the file counter, contact data and download link. This preserves the real API-driven behaviour while removing hydration/network timing races.

## Static verification available in this environment

- `node scripts/audit-frontend-foundation.mjs`: PASS.
- Foundation imported last: yes.
- Missing required tokens: 0.
- Contrast failures below 4.5: 0.
- Changed TS/TSX files were parsed with global TypeScript in no-resolve mode; only expected missing-module/type-context diagnostics were produced because dependencies are not installed in the execution container.
- Full Playwright/browser run could not be executed here because package installation is unavailable offline.

## Owner validation

Run on the Windows workstation:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npx.cmd playwright test e2e/phase1-shell.spec.ts e2e/phase2-ui-kit.spec.ts e2e/phase3-dashboard-applications.spec.ts e2e/phase4-clients-executors.spec.ts e2e/phase5-orders-order-detail.spec.ts
```
