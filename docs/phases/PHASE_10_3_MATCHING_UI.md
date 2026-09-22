# Phase 10.3 — Direct Matching UI / Manager Selection

Baseline: `Phase 10.2 Direct Matching v1` (backend candidate endpoint already implemented).
Scope: Orders/Works frontend integration only, plus focused frontend verification/docs. No routing or new database schema.

## Goal

Expose the factual Phase 10.2 direct candidates inside the existing persisted OrderWork editor so a manager can inspect availability/rate facts and deliberately add one executor to the existing `executor_assignments` draft. Selection must never auto-save or auto-assign; the existing `Сохранить работу` action remains the persistence boundary.

## UX contract

1. The existing `ExecutorAssignmentsEditor` remains the single assignment editor.
2. For a persisted work in edit mode, show `Подобрать исполнителя` next to the existing manual `Добавить исполнителя +` action.
3. Fetch only `GET /api/admin/orders/{order_id}/works/{work_id}/executor-candidates` on manager action. Do not silently poll.
4. Candidate cards show only backend facts:
   - executor name;
   - saved bidirectional language pair;
   - service;
   - default rate and rate unit;
   - `Свободен`, `Доступность не указана`, or a blocking persisted state;
   - the required date used by matching when present.
5. Present candidates in backend order. Do not add a score, percentage, rating, synthetic recommendation or "best" label.
6. `AVAILABLE` and `UNKNOWN` candidates may be selected by the manager. `UNAVAILABLE` candidates remain visible for explanation but are not selectable for the matched deadline.
7. Selecting a candidate adds one ordinary draft `ExecutorAssignment` using the existing model:
   - executor id from the candidate;
   - candidate default rate/rate unit as defaults;
   - work volume as the initial executor volume;
   - executor deadline, falling back to work deadline;
   - no manual cost override.
8. Candidate selection does not persist until `Сохранить работу` is pressed.
9. If the executor is already present in the work draft, show `Уже выбран` and do not duplicate the assignment.
10. The existing manual lookup path remains available and unchanged.
11. Empty result state must say `Исполнитель не найден` and point to manual assignment rather than inventing a fallback.
12. Missing service/language inputs must explain which data needs to be completed.
13. Because the Phase 10.2 endpoint evaluates persisted work data, if matching-relevant fields have unsaved changes, disable refresh and tell the manager to save the work first.
14. New/unsaved works in the order wizard keep manual assignment only; direct matching is available after the work exists.

## Error/loading/accessibility

- Button has `aria-expanded` and `aria-controls`.
- Candidate area uses a labelled region and `aria-live` for load/result feedback.
- API error is displayed inline without destroying existing assignments.
- Keyboard operation uses normal buttons; no click-only cards.
- Responsive layout must reflow, never create page-level horizontal overflow.

## Non-goals

Do not implement:
- automatic assignment or autosave;
- routing through Russian;
- route stages;
- candidate ranking/scoring;
- automatic BUSY creation;
- Finance changes;
- schema/migration changes;
- global mobile stabilization (Phase 10.9);
- brand redesign (Phase 10.7).

## Acceptance criteria

1. Persisted work exposes `Подобрать исполнителя`.
2. Candidate data comes from the Phase 10.2 endpoint only.
3. Candidate states/rates/pairs are truthfully rendered.
4. UNKNOWN is never relabelled as FREE.
5. Blocking candidate cannot be selected from the matched-deadline UI.
6. Selecting a candidate populates the existing assignment form with executor/rate/unit/volume/deadline defaults.
7. Existing assignment is not duplicated.
8. Manager can still change all assignment-specific values before saving.
9. Existing manual `Добавить исполнителя +` remains available.
10. No backend/migration/Finance/routing change enters the patch.
