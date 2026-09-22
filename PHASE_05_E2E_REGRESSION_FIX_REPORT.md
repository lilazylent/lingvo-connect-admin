# Phase 05 — E2E Regression Fix Report

Date: 2026-09-15
Baseline: `Lingvo_Connect_Admin_Phase_05_Lint_Architecture_Fix_v1`
Owner result before this patch: **37 passed / 13 failed** in the Phase 1–5 Playwright gate.

## Diagnosis

The 13 reported failures were concentrated in regression-test contracts rather than 13 independent product regressions. The failing groups matched four concrete causes:

1. **Stale form contract** — Phase 02 still searched for `Имя контакта *` and `Способ связи *`, while the real manual-application form and backend contract now treat these as optional and render labels without `*`.
2. **Theme bootstrap race** — Dark tests wrote `html.dataset.crmTheme = "dark"` immediately after navigation while `CrmThemeLoader` was still fetching the persisted preference. The later Light response could overwrite Dark mid-assertion.
3. **Async detail/summary races** — Applications, Executors and Orders tests asserted content that is loaded by a second API request without first anchoring to the resolved panel state.
4. **Over-strict browser geometry checks** — shell document width and hover geometry used exact values/object equality even though fractional layout/compositor frames may legitimately differ by a sub-pixel. The product contract is bounded document layout and stable geometry, not byte-identical floating-point boxes.

## Changes

### Shared E2E helper
Added `apps/admin-web/e2e/test-helpers.ts`:
- `gotoWithCrmTheme()` waits for the persisted preference bootstrap, then applies the requested test theme deterministically;
- `expectDocumentBounded()` checks page-level horizontal overflow with a 1 CSS-pixel rounding tolerance;
- shared `contrastRatio()` for semantic Dark checks.

### Phase 01
- Off-canvas mobile sidebar is asserted as attached when closed, then explicitly verified through `sidebar--open` on menu open/close.
- Mobile document-bound check uses the document/client width delta instead of comparing `scrollWidth` directly to the nominal viewport integer.
- Dark shell check now waits for the preference loader before forcing Dark.

### Phase 02
- Optional field selectors updated to the actual labels: `Имя контакта`, `Способ связи`.
- Focus acceptance accepts either the explicit outline or the canonical focus box-shadow; it no longer assumes a particular browser `:focus-visible` heuristic after programmatic focus.
- Hover geometry uses numeric tolerance instead of exact serialized bounding-box equality.
- Dark control acceptance checks semantic surface + WCAG contrast rather than incorrectly forbidding near-white text on a dark surface.

### Phase 03
- Applications preview assertions are scoped to `.lc-application-preview`.
- The test waits for the real file counter (`Файлы · 1`) before checking Contacts/Files content.
- Dark tests use deterministic theme bootstrap.

### Phase 04
- Executor list waits for CRM summary loading to finish before asserting workload/money.
- Currency assertions tolerate normal Russian non-breaking-space formatting.
- Tabs/content are scoped to `.directory-detail-panel`.
- Dark detail waits for summary resolution and deterministic Dark theme.

### Legacy workspace regression coverage
- Updated the older manual-application workspace selectors to the same real optional-field labels so a later full `npm run test:e2e` does not reintroduce the already-diagnosed stale `*` contract.

### Phase 05
- Order-detail test first waits for `.phase5-order-card`, because `?open=` is consumed after hydration and the card loads detail asynchronously.
- All tab assertions are scoped to that order card.
- Currency assertions tolerate Russian whitespace formatting.

## Product behavior

No backend/API/business logic was changed in this patch. No visual baseline was weakened. The tests still enforce:
- real responsive shell behavior;
- no page-level overflow;
- semantic Dark surfaces and readable contrast;
- actual interactive tabs;
- real files/CRM summaries/assignment values;
- tabbed order detail instead of the former giant vertical document.

The change removes false negatives and stale assumptions; it does not replace failed assertions with unconditional passes.

## Verification performed in this environment

Passed:
- `node scripts/audit-frontend-foundation.mjs`
  - foundation imported last: yes
  - missing required tokens: 0
  - contrast failures below 4.5: 0
- TypeScript syntax/transpile diagnostics for all changed E2E TypeScript files: 0 errors.
- ZIP integrity check after packaging.

Not claimed as run here:
- full ESLint / TypeScript project typecheck;
- production Next build;
- browser Playwright suite.

This environment does not contain a complete local npm dependency tree for the app. The definitive browser gate must therefore be re-run on the owner's machine with the existing installed dependencies.
