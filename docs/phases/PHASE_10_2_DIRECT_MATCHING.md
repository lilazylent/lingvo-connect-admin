# Phase 10.2 — Direct Executor Matching

Baseline: `phase10-availability-calendar-20260917-r2`
Scope: backend matching service + read-only candidate API + tests/documentation only.

## Goal

Given one persisted `OrderWork`, return real executor candidates whose saved `ExecutorDirection` supports the same canonical service and bidirectional language pair, enriched with persisted availability and default rate data. The CRM must not assign, rank, score or mutate anything in this phase.

## Source of truth

- `OrderWork.service_code`, falling back to `work_type` only when the canonical field is blank.
- `OrderWork.source_language` / `target_language`.
- required date: `executor_deadline` -> `deadline` -> parent `Order.deadline`.
- `ExecutorDirection.work_type`, language pair, `default_rate`, `rate_unit`.
- non-archived `Executor` rows only.
- non-archived `ExecutorAvailability` intervals.

## Matching rules

1. Service code must match exactly after safe trimming/case-normalization.
2. Language pairs are bidirectional:
   - RU↔EN matches RU→EN and EN→RU.
   - JP↔EN is a valid direct foreign-to-foreign capability.
3. Empty source/target/service makes the work non-matchable; do not guess.
4. Archived executors are excluded.
5. No hidden score, rating or capacity percentage is produced.
6. Candidate ordering is deterministic and factual only:
   `AVAILABLE -> UNKNOWN -> UNAVAILABLE`, then executor name/id.

## Availability semantics

Phase 10.2 has only a deadline date, not a full required work interval. Therefore it evaluates the best persisted required date without inventing a start date.

- explicit `FREE` covering the required date -> `AVAILABLE`, `deadline_compatible=true`;
- explicit `BUSY`, `UNAVAILABLE` or `VACATION` -> `UNAVAILABLE`, `deadline_compatible=false`;
- no covering interval -> `UNKNOWN`, `deadline_compatible=null`;
- no required date -> `UNKNOWN`, `deadline_compatible=null`.

Unknown must never be presented as free.

## API

`GET /api/admin/orders/{order_id}/works/{work_id}/executor-candidates`

Read-only response includes:

- work matching inputs;
- `matchable` and `missing_fields`;
- resolved service name when available;
- resolved required date and its source;
- direct capability candidates;
- matched saved language pair;
- executor default rate/unit;
- availability state/interval/notes;
- factual candidate state and compatibility;
- counts by state.

## Non-goals

Do not implement:

- automatic assignment;
- candidate selection mutation;
- UI candidate cards;
- routing through Russian;
- route stages;
- assignment schema changes;
- finance changes;
- automatic BUSY creation;
- AI/recommendation scoring;
- Phase 10.9 mobile cleanup.

## Acceptance criteria

1. Real direct candidates come only from saved executor capability records.
2. Pair matching works both directions.
3. Direct foreign-to-foreign matching works.
4. Wrong service or wrong pair is excluded.
5. Archived executors are excluded.
6. Availability produces AVAILABLE / UNKNOWN / UNAVAILABLE truthfully.
7. Deadline precedence is executor deadline, work deadline, order deadline.
8. Missing matching inputs return a safe non-matchable response rather than invented data.
9. Endpoint is authenticated read-only and performs no writes.
10. No migration is introduced and Phase 0-10.1 behavior remains unchanged.
