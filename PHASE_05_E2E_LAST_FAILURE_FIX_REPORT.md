# Phase 05 — final remaining E2E locator fix

Date: 2026-09-15
Baseline: `Lingvo_Connect_Admin_Phase_05_E2E_Final_3_Fix_v1`

## Reported state

Owner reran the Phase 01–05 Playwright gate and reported:

- 49 tests passing;
- one remaining failure: `phase3-dashboard-applications.spec.ts` — `Applications selected preview exposes real interactive tabs and real files`.

## Static diagnosis

The Contacts tab intentionally renders both the normalized Email field and the raw backend `contact` field. In the Phase 03 fixture, both values are `anna@example.invalid`. The old assertion used an unscoped exact-text locator against the whole application preview, so it can resolve two identical visible nodes and fail Playwright strict locator rules even though the product is rendering the correct backend data.

## Fix

The E2E contract now scopes assertions to the owning labelled field inside `.lc-detail-data--contacts`:

- Email assertion is scoped to the `Email` row;
- Phone assertion is scoped to the `Телефон` row.

The product/API behaviour is not weakened or changed. The test now verifies the semantic field that owns the value instead of relying on global text uniqueness.

## Phase 06 / post-MVP documentation

This patch also writes the planned Phase 06 contract and the deferred post-MVP Phase 10 matching/routing contract so later agents do not accidentally pull automatic executor matching into the MVP phases.

## Verification available in this environment

- `node scripts/audit-frontend-foundation.mjs`: PASS from `apps/admin-web`;
- foundation imported last: yes;
- missing required tokens: 0;
- contrast failures below 4.5: 0;
- changed Phase 03 Playwright spec parsed through TypeScript `transpileModule`: 0 syntax diagnostics.

Full Playwright execution is not claimed in this environment because npm dependency installation is unavailable/times out. The owner workstation remains the authoritative runtime gate.
