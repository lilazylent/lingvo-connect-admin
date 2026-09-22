# Master Execution Prompt — Phase 10.4 Routing through Russian

You are implementing Lingvo Connect Phase 10.4 on top of the exact Phase 10.3 Matching UI v1 source tree.

## Mandatory protocol
LATEST CODE -> PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> RE-READ -> VERIFY -> REPORT -> NEW BASELINE.

Do not redesign unrelated UI. Do not create a new CSS override layer. Patch canonical owners only. Do not claim checks that did not run.

## Objective
Add deterministic factual fallback routing through Russian for foreign-to-foreign OrderWork matching while preserving manager control and all Phase 10.2/10.3 semantics.

## Backend
- Reuse one internal candidate matcher for any requested language pair.
- Keep direct candidates exactly as before.
- Resolve active canonical `Русский` from LanguageCatalog; do not invent an ISO code.
- For foreign->foreign work build two stage descriptions: source->Русский and Русский->target.
- Return factual candidates for each stage with the same availability/deadline semantics and backend ordering.
- Do not write database state.
- Do not add a migration.

## Frontend
- Extend the existing matching response/types only.
- Direct candidates stay first.
- Add a compact sequential `Маршрут через русский` section for eligible works.
- Show stage 01 and stage 02, pair, candidate facts, state badge and rate.
- Allow one local selected candidate per route stage; AVAILABLE and UNKNOWN selectable, UNAVAILABLE disabled.
- Do not append routed choices to ordinary ExecutorAssignment drafts yet because persisted route-stage semantics belong to Phase 10.5.
- Make the non-persistent boundary explicit in UI copy.
- Preserve manual assignment.

## Constraints
No fake data, hidden score, automatic recommendation, automatic selection, Finance changes, route persistence, actual intermediate volumes, or non-Russian routing.

## Verification
Add backend regression coverage for routed matching and frontend static/audit coverage. Re-run existing backend CRM/operations tests and current frontend audits where executable.
