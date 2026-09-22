# Phase 11 Master Prompt — Data Integrity & Calculator Fixes

Work only from the latest Phase 10.6 source tree. Follow PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> VERIFY -> REPORT.

## Goal
Fix the client-review blocking data-integrity issues without starting the future service-driven form redesign.

## Required implementation
- Introduce one backend business helper for conditional-page conversion: `1800 chars = 1 page`, rounded upward to one decimal place.
- Keep tariff minimum quantity separate from the physical/operational page conversion.
- Mirror the same draft calculation in the frontend so preview and persisted values cannot disagree.
- Verify executor assignment persistence end-to-end: executor id, assignment rate, page count, cost and finance after order reload.
- Preserve executor default rates; overrides belong to `ExecutorAssignment` only.
- Do not add a migration unless an actual persistence gap requires one.
- Do not touch Phase 14 dynamic service fields.

## Verification
- Backend CRM + operations tests.
- Explicit regression for 1801 chars -> 1.1 page.
- Explicit create -> reload assignment persistence regression.
- Python compile.
- Alembic single-head check.
- Existing frontend audits.
- Attempt production build only if dependencies are available; never claim it passed otherwise.
