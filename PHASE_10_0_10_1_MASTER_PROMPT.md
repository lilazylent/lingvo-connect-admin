# Phase 10.0 + 10.1 master execution prompt

You are implementing Lingvo Connect CRM Phase 10.0 + 10.1 from frozen baseline `phase09-mvp-release-candidate-20260916-r3`.

## Mandatory protocol

Use:

`PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> RE-READ -> VERIFY -> REPORT -> NEW BASELINE`

Before editing, re-read current `AGENTS.md`, Phase 10 post-MVP spec, models, API routes, migration graph, Executor UI, Order/assignment contracts and CSS ownership map. Current code is source of truth; never code from memory.

## Objective

Freeze the Phase 10 architecture and implement persisted executor availability only. The system must know real executor capabilities, default rates and explicit calendar availability before any candidate matching is attempted.

## Required architecture

- Preserve `Order -> OrderWork -> ExecutorAssignment`.
- Do not create a second assignment model/system for matching.
- Preserve existing manual multi-executor split behavior.
- Future automatic routes will use one executor per route stage.
- Language capability pairs are bidirectional.
- Empty availability never means FREE.

## Availability requirements

Persist inclusive date intervals with states:

- `FREE` — `Свободен`
- `BUSY` — `Занят`
- `UNAVAILABLE` — `Недоступен`
- `VACATION` — `Отпуск`

Prevent overlapping active intervals for one executor at the API layer. Reject end date before start date. Use optimistic record versions for update/remove and normal CRM activity logging.

## UI requirements

Add `Доступность` to Executor detail using the existing Phase 04 directory workspace and shared Phase 02 controls. Do not invent a new visual system or CSS owner.

The UI must support:

- real list/empty/loading/error states;
- add/edit/remove period;
- state, start date, end date, optional note;
- archived executor read-only behavior;
- responsive layout and Dark/Light semantic tokens.

Required empty-state meaning: `Доступность не указана`.

## Explicit non-goals

Do not implement:

- candidate search;
- candidate ranking;
- direct matching;
- routing through Russian;
- route-stage assignment UI;
- automatic busy period generation;
- Finance changes;
- brand redesign;
- future configurable pipelines.

## Verification

Run only checks that actually exist in the repository/environment, and never claim an unrun check passed. At minimum attempt:

1. Python syntax/compile.
2. Targeted backend availability tests and existing executor/order regression tests.
3. Alembic graph: exactly one head.
4. Frontend foundation/CSS ownership/Phase 8/Phase 9 static audits.
5. TypeScript typecheck/build when dependencies are available.
6. Browser QA when runtime is available.

Deliver a clean archive, changed-files list, implementation report and exact PowerShell/Docker update commands for the changed backend + frontend + migration.
