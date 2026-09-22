# Phase 12 Owner Patch 02 — Assignment Persistence & Executor Calculator

Build target: `phase13-internal-works-20260919-r1`

## Problem confirmed from owner QA
In the routed matching UI a manager could click `Выбрать для этапа` and type manual rates (e.g. 500 / 250 ₽). The candidate cards looked selected, but the selection/rate lived only in local matching state. `work.executor_assignments` stayed empty until a separate route-confirmation action. For candidates with `Доступность не указана`, that confirmation could be blocked because backend route completeness required `AVAILABLE`. Result: Step 06 showed `Выплаты исполнителям: 0 ₽`, no calculated executor cost, and nothing meaningful persisted.

## Required behavior
- Selecting a routed candidate must immediately create/update the draft `ExecutorAssignment` for that stage.
- A manual rate edit must immediately update the selected draft assignment.
- The wizard review (Step 06) must calculate executor payouts from the same draft assignments that will be posted on create.
- Conditional-page volume must use the work character count/page count already extracted in the wizard.
- Persisted assignments must restore selected stage/rate state on reopen/edit.
- `UNKNOWN` availability means “not confirmed free”, not “blocked”. Manager may explicitly choose it; `BUSY`, `VACATION`, `UNAVAILABLE` remain blocked.
- Backend must calculate and persist assignment rate, page_count, auto_cost/cost, and Finance totals.
- Default executor-direction rate must never be mutated by an order-specific manual rate.
- Do not introduce a second calculator or assignment model.

## UI cleanup
- `По умолчанию` aligns to the left directly under the manual-rate input.
- Availability badge keeps a stable center/right grid position in the candidate card.

## Acceptance example
Work: 14,534 chars = 8.1 conditional pages.
Stage 01 manual rate: 500 ₽ -> 4,050 ₽.
Stage 02 manual rate: 250 ₽ -> 2,025 ₽.
Step 06 payouts: 6,075 ₽.
After create + reload: both executors, both rates, 8.1 pages, per-stage costs and total 6,075 ₽ remain persisted.
