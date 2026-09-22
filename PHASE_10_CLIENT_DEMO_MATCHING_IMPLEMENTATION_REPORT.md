# Phase 10 — Priority Client Demo Matching Implementation Report

Build ID: `phase10-client-demo-matching-20260918-r1`

## Baseline
`Lingvo_Connect_Admin_Phase_10_4_Routing_v1.zip`

## Implemented
### One backend matcher for saved and unsaved works
`apps/api/app/executor_matching.py` now exposes the same deterministic matching pipeline for:
- persisted OrderWork matching;
- new-order wizard preview matching.

Language pairs remain bidirectional.

Direct candidate ordering is deterministic:
1. AVAILABLE;
2. UNKNOWN;
3. UNAVAILABLE;
then known positive default rate, normalized name and id.

A route through Russian is suppressed when a confirmed `AVAILABLE` direct candidate exists.
A Russian route is complete only if both stages have a confirmed `AVAILABLE` executor.

### New preview API
Added:
`POST /api/admin/orders/executor-candidates/preview`

It is read-only and uses the canonical backend matcher.

### Wizard Step 05 integration
Every work on Step 05 now automatically calls preview matching.
The same matching UI used by saved works renders:
- direct candidates;
- factual availability;
- rates/units;
- Russian composite route.

For a complete composite route, the first deterministic AVAILABLE candidate on each stage is preselected as the proposal. Nothing is persisted until the manager clicks:
`Назначить предложенных исполнителей`.

Direct selection remains manager-controlled.

### Composite route persistence
The existing assignment model could store multiple executors but could not preserve stage semantics. Added the minimal metadata to `ExecutorAssignment`:
- `route_stage_index`;
- `route_source_language`;
- `route_target_language`.

Migration:
`0020_executor_route_metadata`

No new RouteStage table/subsystem was created.

Before saving a routed assignment, the backend re-runs current matching and verifies:
- exactly stages 1 and 2;
- current stage language pairs;
- chosen executor still belongs to the factual stage candidate set;
- chosen executor is currently `AVAILABLE`.

### Number badge correction
Added shared Phase 05 owner pattern `.lc-number-badge` and applied it to repeated work-number badges. Geometry now uses explicit equal dimensions, grid centering, zero padding and `line-height: 1`.

## Tests actually run
Backend regression:
`pytest -q tests/test_crm.py tests/test_operations.py`
Result: **20 passed**.

Covered explicitly:
- RU→EN;
- EN→RU bidirectionality;
- deterministic multiple direct candidates;
- JA→RU→EN;
- BUSY stage rejection;
- direct JA↔EN priority;
- no-match state;
- wizard persistence of two route assignments.

Python compile: PASS.

Alembic heads:
`0020_executor_route_metadata (head)` — single head.

Frontend audits:
- foundation: PASS;
- CSS ownership: PASS;
- Phase 08 owner: PASS;
- Phase 09 RC: PASS;
- Phase 10 availability: PASS;
- Phase 10 matching UI: PASS;
- Phase 10 routing: PASS;
- new Phase 10 client-demo audit: PASS.

TypeScript/TSX transpile syntax scan: **44 files, 0 syntax errors**.

## Production build status
A production build was attempted.
`npm run build` could not start because this source archive contains no `node_modules` (`next: not found`).
An offline `npm ci` was also attempted but the local npm cache did not contain `zod-validation-error-4.0.2.tgz` (`ENOTCACHED`).
Therefore production build is **not claimed as passed in this environment**. The local Docker build commands below are the runtime gate.

## Known limitation
Availability is currently evaluated against the canonical required date (executor deadline → work deadline → order deadline). The model does not yet have a separate production start/end window for matching, so matching does not claim multi-day capacity beyond the date evidence currently stored by the product.

For composite wizard assignments, the current work volume is used as the initial planned volume on each stage. The manager can edit assignment volume/cost. Dedicated stage actual-volume semantics remain the later Phase 10.5 concern.

## PowerShell update/run
This version changes frontend, backend and database schema.

```powershell
cd "ПУТЬ-К-ПРОЕКТУ"

docker compose build backend frontend
docker compose up -d postgres
docker compose run --rm backend alembic upgrade head
docker compose up -d backend frontend
docker compose ps
```

Expected migration head after update:
`0020_executor_route_metadata`.
