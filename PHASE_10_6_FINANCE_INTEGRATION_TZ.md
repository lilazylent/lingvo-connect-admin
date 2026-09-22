# Phase 10.6 — Finance Integration

## Goal
Connect persisted executor assignments and routed production stages to the existing order finance model without changing client pricing rules.

## Source of truth
Baseline: Phase 10.5 Route Stages + Manual Rate v1.

## Domain rules
- Client revenue remains the sum of `OrderWork.price`.
- Executor cost comes from active persisted `ExecutorAssignment.cost` rows whenever assignments exist.
- A routed order is not priced as a synthetic route. Each stage contributes its own persisted actual cost.
- Manual assignment rate affects `auto_cost`; manual total-cost override remains authoritative for that assignment.
- Client price and executor cost are independent systems.
- `profit = revenue - executor_cost`.
- `margin_percent = profit / revenue * 100`, with zero revenue guarded safely.
- Legacy works without assignment rows retain the existing `OrderWork.executor_cost` fallback.
- No new migration is required.

## Backend
Extend the existing `finance()` result with a factual executor breakdown grouped by work and assignment. Do not introduce a second finance engine.

Each work breakdown exposes:
- work identity and language pair;
- client price;
- total executor cost;
- legacy fallback marker;
- persisted assignments with route stage, executor, actual volume, rate, auto cost, actual cost and manual-cost marker.

## Frontend
In `Заказ → Финансы`, retain the existing canonical metrics and add a compact `Структура выплат` section backed by the backend breakdown.
For routed work show each stage independently.
For direct assignments show `Прямое назначение`.
Do not expose invented costs or estimates.

## Acceptance
1. Direct assignment cost contributes once to executor cost.
2. Two-stage JA → RU → EN costs are summed exactly once.
3. Different actual stage volumes remain independent.
4. Manual rate is reflected through persisted assignment cost.
5. Manual total cost remains authoritative when present.
6. Profit and margin use the persisted executor total.
7. Client revenue is unchanged by executor rate/cost changes.
8. Legacy works without assignment rows still calculate safely.
9. No migration is added.
10. Existing Phase 0–10.5 regression checks remain green.
