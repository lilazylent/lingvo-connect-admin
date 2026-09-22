# Phase 12 Master Prompt — Order Numbering & Metadata

Work from Phase 11 Data Integrity v1 as the sole source of truth.

Follow PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> VERIFY -> REPORT.

Implement only Phase 12:

1. Replace new public order identifiers with `YY-0-NNNN`.
2. Interpret `YY` as the order execution year (overall deadline year); if no deadline exists, fall back to the current calendar year.
3. Reset the sequence per execution year: `26-0-0001`, `26-0-0002`, `27-0-0001`.
4. Keep allocation in one backend service/helper and reuse it from every order creation path, including wizard and import.
5. Allocation must be deterministic and safe for concurrent PostgreSQL requests.
6. Do not invent a frontend counter.
7. Keep order number immutable after creation.
8. Reuse existing `created_at`; display creation date beside the number in order detail and compactly in table/Kanban.
9. Do not touch Phase 13 internal/non-billable works or Phase 14 service-driven forms.
10. Do not add a migration unless the existing counter storage cannot support the rule.

Verification:
- backend compile;
- tests for 26-0-0001/26-0-0002/year reset/no-deadline fallback;
- end-to-end wizard test proving deadline year controls number;
- regression tests;
- Alembic heads;
- frontend audits and TS/TSX parse;
- attempt production build and report environment limitations truthfully.
