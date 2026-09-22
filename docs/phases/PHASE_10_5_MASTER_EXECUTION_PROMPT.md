# Master Execution Prompt — Phase 10.5

You are continuing Lingvo Connect from the latest accepted `Phase 10 Client Demo Matching v1` baseline.

Follow the repository protocol: PRE-FLIGHT → DIAGNOSIS → PLAN → MINIMAL COHERENT PATCH → VERIFY → REPORT.

## Mission
Finalize the existing executor-assignment production model for Phase 10.5 and add an assignment-specific manual rate override directly in Step 05 `Исполнители`.

## Hard constraints
- Re-read current models, API payloads, matching engine, wizard Step 05, assignment editor, tests and CSS owners before editing.
- Reuse existing `ExecutorAssignment`; do not invent a second route-stage persistence model when current fields are sufficient.
- The executor directory `default_rate` is read-only during order assignment. A manual rate applies only to that assignment.
- Direct and routed candidates must use the same concept.
- Route Stage 01 and Stage 02 need independent rate overrides.
- Actual stage volume remains editable after assignment and is persisted independently per assignment.
- Backend remains the source of truth for persistence/cost calculation. Frontend may draft values, not synthesize domain truth.
- Do not begin Phase 10.6 finance redesign.
- No new `!important`; modify the existing Phase 05 owner CSS only.

## Required implementation
1. Add local Step 05 candidate-rate override state keyed by candidate and route stage.
2. Show compact `Ставка вручную` control under/near the displayed default rate.
3. Seed override with candidate default rate, allow non-negative decimal input, allow cancelling back to default.
4. On direct assignment copy the effective candidate rate and existing rate unit into `DraftExecutorAssignment`.
5. On composite assignment copy each stage's own effective rate independently.
6. Keep the detailed assignment editor fields for actual volume/rate/cost and ensure their values serialize to existing API payloads.
7. Add backend regression coverage proving two route stages persist different actual volumes/rates and calculate independent costs.
8. Add a Phase 10.5 static audit for required UI/persistence markers.
9. Update build provenance and documentation.

## Verification
- Python compile.
- Backend targeted/full CRM tests.
- Alembic heads: one head only; no new migration if model remains sufficient.
- Frontend foundation/CSS ownership/Phase 8/9/10.1/10.3/10.4/client-demo/10.5 audits.
- TypeScript syntax parse.
- Production build if dependencies are available; otherwise report the exact blocker.
- Package a clean ZIP and provide commands matching actual changed layers.
