# Phase 10.6 Master Prompt — Finance Integration

Work from the latest Phase 10.5 archive only. Follow PRE-FLIGHT → DIAGNOSIS → PLAN → MINIMAL COHERENT PATCH → VERIFY → REPORT.

Implement finance integration for persisted executor assignments and routed stages.

Constraints:
- Reuse the existing backend `finance()` function as the single source of truth.
- Do not introduce a parallel finance calculator in React.
- Do not modify client pricing/tariff logic.
- Do not add migrations unless a real persistence gap is proven.
- Sum active `ExecutorAssignment.cost` exactly once per work; retain legacy `OrderWork.executor_cost` only where no assignment rows exist.
- Keep manual rate and manual total-cost semantics from Phase 10.5.
- Add a factual backend breakdown suitable for UI rendering.
- Render a compact finance breakdown inside the existing Phase 05 finance workspace and CSS owner.
- Routed stages must display their own executor, language direction, actual volume, rate and cost.
- No fake values, ratings, percentages or estimates.
- Verify direct cost, composite route cost, profit, margin and legacy fallback.
- Preserve all prior phases and current matching/routing behavior.

Deliver TZ, implementation report, changed-files list, verified checks, new build ID and a clean ZIP.
