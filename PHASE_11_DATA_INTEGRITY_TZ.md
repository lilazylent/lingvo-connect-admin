# Phase 11 — Data Integrity & Calculator Fixes

Baseline: `phase10-finance-integration-20260918-r1`
Target build: `phase11-data-integrity-20260918-r1`

## Scope

This phase implements only the client-review blocking fixes that can be completed without the future service-to-field matrix from Oleg.

1. Conditional pages from character count must use the business rule: 1800 characters per page, always round upward to one decimal place.
2. The same rule must be used by backend persisted calculations and frontend draft calculations.
3. Executor selection and assignment-specific manual rate must persist in the database and survive reloading/reopening an order.
4. Assignment cost and order Finance must be recomputed from persisted assignment volume + assignment rate, while the executor directory default rate remains unchanged.
5. Existing direct/composite matching, route metadata and Finance from Phase 10 must remain intact.

## Explicitly out of scope

- New order number format (`YY-NNNN`) — Phase 12.
- Internal/non-billable works — Phase 13.
- Dynamic service-driven work forms — Phase 14, blocked until Oleg supplies the canonical field matrix.
- Global redesign, pipeline/status changes, tariff redesign.

## Acceptance criteria

- 1800 chars -> 1.0 conditional page.
- 1801 chars -> 1.1 conditional pages.
- 3601 chars -> 2.1 conditional pages.
- Tariff `min_quantity` remains independent and can still enforce a billing minimum.
- A selected executor with an assignment rate override survives a fresh GET of the order.
- The assignment-specific override does not mutate `ExecutorDirection.default_rate`.
- Persisted executor cost and order Finance remain identical after reload.
- Existing Phase 10 regression audits pass.
