# Phase 10.3 Master Execution Prompt

You are implementing Phase 10.3 of Lingvo Connect CRM on top of the exact Phase 10.2 Direct Matching v1 source tree.

Work protocol: PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> RE-READ -> VERIFY -> REPORT.

## Source of truth

Re-read before editing:
- `apps/admin-web/AGENTS.md`
- `docs/CRM_MVP_MASTER_SPEC.md`
- `docs/post-mvp/PHASE_10_EXECUTOR_MATCHING_ROUTING.md`
- `PHASE_10_2_DIRECT_MATCHING_TZ.md`
- `apps/api/app/executor_matching.py`
- `apps/api/app/routers/operations.py`
- `apps/admin-web/src/components/crm-orders.tsx`
- `apps/admin-web/src/app/phase5-orders.css`
- current shared UI/API helpers and existing E2E/audit patterns.

## Implementation objective

Integrate the existing read-only direct candidate endpoint into the existing OrderWork assignment editor. The manager explicitly opens matching, reviews factual candidates, and chooses one. Choosing only mutates the current work draft by adding a normal `executor_assignments` entry. Persistence occurs only through the pre-existing `Сохранить работу` flow.

## Hard constraints

- Preserve `Order -> OrderWork -> ExecutorAssignment`.
- No new backend endpoint or migration unless a proven blocker exists. Prefer zero backend changes.
- No automatic selection, autosave or candidate mutation on panel open.
- No score/rating/percentage/capacity inference.
- Keep backend candidate ordering; frontend must not create a "winner".
- `UNKNOWN` means `Доступность не указана`.
- Show blocking candidates for explanation but disable their matched-deadline selection.
- Preserve manual executor lookup and multi-executor manual assignment compatibility.
- Candidate default rate and unit are only draft defaults and remain editable.
- For unsaved matching-field changes, prevent stale matching and ask the manager to save first.
- New unsaved OrderWork cannot call persisted matching.
- Use Phase 05 Orders as CSS owner. Do not add a new phase CSS override file and do not add `!important`.
- Respect System/Light/Dark semantic tokens and responsive breakpoints.
- Phase 10.4 routing through Russian is strictly out of scope.

## Verification

At minimum:
- syntax/type-oriented validation available in the environment;
- existing foundation/CSS/Phase 08/Phase 09/Phase 10.1 audits;
- a new deterministic Phase 10.3 static audit;
- focused Playwright spec/source fixture for candidate UI if browser dependencies are unavailable;
- confirm no migration and no backend source change;
- document every NOT RUN check truthfully.

Deliver updated source ZIP, TZ, master prompt, implementation report, and changed-files list.
