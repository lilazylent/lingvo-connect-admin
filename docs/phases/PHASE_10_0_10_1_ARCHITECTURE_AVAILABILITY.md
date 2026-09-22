# Phase 10.0 + 10.1 — Architecture freeze and executor availability

Build: `phase10-availability-foundation-20260916-r1`  
Baseline: `phase09-mvp-release-candidate-20260916-r3`

## Goal

Prepare the production-safe foundation for executor matching without implementing automatic candidate ranking or routing yet.

At the end of this phase the CRM must be able to answer truthfully:

1. what canonical services and bidirectional language pairs an executor supports;
2. what default rate/unit is stored for each capability;
3. when the executor is explicitly free, busy, unavailable or on vacation;
4. when availability is unknown because no interval was saved.

## Non-goals

This phase does **not**:

- choose an executor automatically;
- expose candidate scoring or ratings;
- build JP→RU→EN routes;
- change Order finance calculations;
- split or replace existing `ExecutorAssignment` behavior;
- auto-create busy intervals from assignments;
- infer `FREE` from an empty calendar.

## Frozen Phase 10 architecture

Existing source-of-truth chain remains:

```text
Order
└── OrderWork
    └── ExecutorAssignment
```

Do not create a parallel assignment subsystem.

Future matching/routing will extend the existing chain. The agreed direction for later Phase 10 work is:

```text
OrderWork
├── client-facing work data
├── routing mode (future Phase 10.2+)
└── ExecutorAssignment[]
    ├── route stage index (future)
    ├── stage source/target language (future)
    ├── executor
    ├── actual stage volume
    ├── assignment rate/unit
    ├── assignment deadline
    └── assignment cost/status
```

The existing manual split assignment feature remains backward-compatible. Automatic routed matching will obey `one production stage = one executor`.

## Capability semantics

`ExecutorDirection` remains the persisted executor capability model.

- `work_type` is the canonical `ServiceType.code` compatibility field.
- `source_language` + `target_language` represent a bidirectional pair.
- `default_rate` + `rate_unit` are defaults only; an assignment may override them later.
- Direct foreign→foreign capability is valid and must not be forced through Russian in future matching.

## Availability persistence

New table/model: `executor_availability` / `ExecutorAvailability`.

Each active record contains:

- executor;
- state: `FREE | BUSY | UNAVAILABLE | VACATION`;
- inclusive `start_date`;
- inclusive `end_date`;
- manager note;
- normal record metadata (`id`, `version`, archive flag, timestamps).

### Determinism rule

Active availability intervals for the same executor may not overlap.

Reason: matching must not receive two contradictory states for the same day. More complex schedules/time-of-day capacity can be added later with an explicit model revision instead of implicit precedence rules.

### Unknown is not free

If no active interval covers a requested date, the availability state is **unknown**. Future matching UI must say `Доступность не указана` rather than claim `Свободен`.

## API contract

```text
GET    /api/admin/executors/{executor_id}/availability
POST   /api/admin/executors/{executor_id}/availability
PATCH  /api/admin/executors/{executor_id}/availability/{availability_id}
DELETE /api/admin/executors/{executor_id}/availability/{availability_id}?version=N
```

Writes require the normal authenticated write/CSRF contract and use optimistic version checking for edit/remove.

Overlap and invalid date ranges are rejected server-side.

## Executor UI contract

Executor detail gets a real tab: `Доступность`.

The manager can:

- add a period;
- choose one of the four persisted states;
- edit a period;
- remove a period;
- leave a note;
- see explicit empty state `Доступность не указана`.

This is a compact operational interval editor, not a decorative month calendar. It remains usable on 320–1440+ layouts and in Light/Dark themes through existing semantic tokens.

## Migration

Alembic revision: `0019_executor_availability`  
Down revision: `0018_archive_status_scopes`

The migration is additive and does not rewrite existing executor/order data.

## Acceptance criteria

1. Existing Phase 0–9 functionality remains intact.
2. Exactly one Alembic head remains.
3. Executor availability is persisted in the database.
4. `FREE`, `BUSY`, `UNAVAILABLE`, `VACATION` are supported.
5. Invalid reversed ranges are rejected.
6. Overlapping active intervals for one executor are rejected.
7. Empty availability means unknown, not free.
8. Manager can create/edit/remove intervals from Executor detail.
9. Availability changes appear in Executor history via operational activity.
10. No matching/routing automation is introduced yet.
11. No fake rating/capacity/availability values are introduced.
12. Existing `ExecutorAssignment` and Finance contracts are unchanged.
