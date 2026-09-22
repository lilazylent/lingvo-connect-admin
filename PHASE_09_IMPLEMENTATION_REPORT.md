> **Latest owner patch:** this original `r1` report is preserved as the start-of-Phase-09 record. The current source build is `phase09-mvp-release-candidate-20260916-r3`; see `PHASE_09_OWNER_PATCH_03_IMPLEMENTATION_REPORT.md` for the archive/status-board backend change, migration `0018_archive_status_scopes`, finance/file layout fixes and updated verification.

# Phase 09 Implementation Report — Final MVP QA / Release Candidate

Date: 2026-09-16  
Baseline: `Lingvo_Connect_Admin_Phase_08_FINAL_Settings_Concept_C_v1.zip`  
Build ID: `phase09-mvp-release-candidate-20260916-r1`

## Result

Phase 09 has started as the whole-MVP stabilization / release-candidate phase. This source pass does not add Phase 10 business functionality. It converts the accepted Phase 08 source into a Phase 09 release-candidate baseline, adds explicit QA gates, fixes the owner-reported Dashboard KPI navigation-arrow regression, and closes two keyboard-accessibility gaps discovered during the cross-project audit.

This report deliberately distinguishes source/static verification from runtime/browser verification. The release candidate is **not** declared owner-frozen until the remaining local dependency/build/Playwright/browser matrix is run successfully.

## Execution contract

The working prompt is stored in:

`docs/phases/PHASE_09_MASTER_EXECUTION_PROMPT.md`

Protocol:

`LATEST CODE -> PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> RE-READ -> VERIFY -> VISUAL QA -> REPORT -> NEW BASELINE`

Phase 09 remains a QA/stabilization phase. Phase 10 executor matching/routing is explicitly out of scope.

## Owner-added Dashboard requirement

The six clickable Dashboard KPI cards are:

- `Новые заявки`
- `Активные заказы`
- `Сдать сегодня`
- `Просрочено`
- `Без исполнителя`
- `Ждут оплаты`

The screenshot showed the navigation arrows sitting visually under the pictogram/text area instead of belonging to a deliberate lower card zone.

### Root cause

The older `.lc-circle-arrow` rule used `position: absolute; right: ...; bottom: ...`, but a later Phase 08 generic rule applied `position: relative` to direct metric-card children. Because of cascade order, the arrow stopped being absolutely anchored and became an unintended grid item. The result matched the supplied screenshot: the arrow looked “stuck on” rather than deliberately placed.

### Fix

The Dashboard KPI card now explicitly owns a three-row grid:

1. pictogram/value row;
2. canonical title row;
3. reserved navigation-footer row.

`.lc-dashboard .lc-circle-arrow` is intentionally placed in row 3 with `justify-self: end` and `align-self: end`. It therefore lives in the lower-right of each real clickable KPI card, cannot collide with title/value content, and no longer depends on fragile legacy absolute offsets.

The fix is in the existing canonical Phase 08 visual owner `phase8-visual-motion.css`; no `phase9.css` was created.

## Cross-project QA fixes discovered in Phase 09

### Applications table keyboard selection

Clickable application rows already supported pointer selection but did not expose equivalent row-level keyboard activation. Phase 09 adds:

- `tabIndex={0}`;
- `aria-selected`;
- Enter / Space activation;
- nested-control guard so menu/buttons inside the row do not accidentally select it.

The existing Phase 3 E2E regression now selects a row with keyboard input.

### Users table keyboard selection

The same gap existed in Users. Phase 09 adds the same keyboard semantics and extends the existing Phase 6 E2E regression before testing the action menu.

## Documentation / ownership cleanup

- `AGENTS.md` now reflects the post-Phase-07 CSS reality: deleted `master-reference.css` / `theme-system.css` are compatibility history and must not be restored.
- `CRM_MVP_MASTER_SPEC.md` Phase ledger now records Phase 07/08 as completed source baselines and Phase 09 as the current stabilization phase.
- `CSS_OWNERSHIP_MAP.md` states that Phase 09 creates no new visual owner; defects must be fixed in the canonical owner.
- Phase 10 remains outside the MVP release-candidate patch.

## Phase 09 QA assets added

### Static audit

`apps/admin-web/scripts/audit-phase9-release-candidate.mjs`

Checks include:

- exact Phase 09 Build ID;
- Phase 09 documentation contract;
- six canonical Russian KPI titles;
- Phase 08 filler text does not return;
- Dashboard arrow has a deliberate lower-grid placement;
- no `phase9.css`;
- deleted compatibility CSS remains deleted;
- Phase 10 matching/routing markers do not leak into the MVP;
- `!important` debt does not exceed the Phase 08 baseline;
- Applications and Users retain keyboard-selectable rows.

### Runtime E2E specification

`apps/admin-web/e2e/phase9-release-candidate.spec.ts`

At 1440 / 1024 / 768 / 390 widths it is prepared to verify:

- six KPI cards render;
- no document horizontal overflow;
- each navigation arrow remains within its card;
- arrow is below the title area and in the lower-right zone;
- DOM exposes the Phase 09 Build ID.

This E2E file is authored but is **not claimed as executed** in this environment because the frontend dependency tree is unavailable.

## Verification actually run in this environment

### PASS — frontend static audits

- `npm run audit:foundation`
  - foundation imported last: true
  - missing required tokens: 0
  - contrast failures below 4.5: 0
  - Light primary 17.62
  - Light secondary 5.05
  - Light muted 4.51
  - Light accent/surface 5.76
  - Dark primary 16.25
  - Dark secondary 11.02
  - Dark muted 6.36
  - Dark accent/surface 4.52
- `npm run audit:css-ownership`: PASS
- `npm run audit:phase8-owner`: PASS
- `npm run audit:phase9`: PASS
  - Dashboard KPI arrow grid placement: OK
  - Phase 10 boundary: OK
  - CSS `!important`: 30, Phase 08 ceiling 30
  - deleted compatibility styles remain absent

### PASS — source integrity

- all 10 active app CSS files parsed with `tinycss2`: 0 parse errors;
- parser-level TypeScript check over the changed TSX/E2E files found 0 `TS1xxx` syntax/parser diagnostics;
- backend Python modules and Alembic migrations compile with `python -m compileall`;
- Alembic graph has 19 revisions and exactly one head: `0017_phase6_catalogs`.

### NOT CLAIMED — full frontend dependency/runtime gate

A fresh frontend dependency installation could not be completed in this execution environment, so the following are not claimed as passed here:

- full project `npm run typecheck` with the real Next/React/Playwright type graph;
- ESLint;
- `next build`;
- Playwright Phase 0–9 suite;
- live rendered Light/Dark responsive/zoom matrix.

A parser-only `tsc --noResolve` check was still run. Its remaining diagnostics are unavailable-module/type-resolution diagnostics caused by the missing dependency tree, not syntax diagnostics.

### NOT CLAIMED — backend pytest

`pytest -q` was attempted but collection stops before tests because the environment does not contain `pyotp`:

`ModuleNotFoundError: No module named 'pyotp'`

No backend source was changed by this Phase 09 source pass. Python compilation and Alembic topology checks pass, but the backend pytest suite is not claimed as passed.

## Backend / database

No backend/API/database/Alembic changes were made. No migration is required.

## Local acceptance still required before owner freeze

On the owner's normal Docker/dev environment, Phase 09 still needs the real release gate:

- frontend rebuild;
- typecheck/lint/build with installed dependencies;
- Phase 0–9 Playwright regression;
- Light + Dark visual review;
- widths 320, 360, 375, 390, 430, 620, 768, 900, 1024, 1180, 1280, 1440, 1920;
- zoom 100, 125, 150, 175, 200, 250%;
- empty/loading/error/disabled/focus/hover/selected states;
- long Russian labels / filenames;
- all menu/tab/button/clickable-card/scroll flows;
- Orders/Kanban/Works/Finance/Files/History/Settings/Auth CRUD regression.

Only after that runtime gate should Phase 09 be marked frozen and promoted as the final MVP release candidate before Phase 10.
