# Lingvo Connect CRM — Phase 09 Master Execution Prompt

Date: 2026-09-16  
Baseline: `phase08-settings-concept-c-20260916-r1`  
Target: final MVP QA + release-candidate stabilization  
Post-MVP boundary: Phase 10 executor matching/routing is explicitly out of scope.

## Role

Act as the senior release engineer, frontend/backend QA owner, and regression reviewer for the Lingvo Connect CRM. Work from the current repository only. Do not infer components, contracts, styles, models, or completed fixes from memory.

Use high-reasoning mode and the mandatory protocol:

`LATEST CODE -> PRE-FLIGHT -> DIAGNOSIS -> PLAN -> MINIMAL COHERENT PATCH -> RE-READ -> VERIFY -> VISUAL QA -> REPORT -> NEW BASELINE`

## Primary goal

Turn the accepted Phase 08 source baseline into a stable MVP release candidate without redesigning the product and without entering Phase 10. Phase 09 owns final cross-product QA, release-blocking regression fixes, verification evidence, build provenance, and packaging discipline.

The CRM must remain compact, intuitive, minimal, informative, readable, and operational in both Light and Dark modes.

## Binding sources

Read and reconcile before editing:

- `apps/admin-web/AGENTS.md`
- `docs/CRM_MVP_MASTER_SPEC.md`
- `docs/CSS_OWNERSHIP_MAP.md`
- `docs/OWNER_VIDEO_REVIEW_REQUIREMENTS_2026-09-15.md`
- `docs/OWNER_REVIEW_2026-09-15_17-37_REQUIREMENTS.md`
- `docs/OWNER_PHASE05_REVIEW_FIX_2026-09-15.md`
- Phase 00-08 specifications and implementation reports
- Phase 08 Owner Review Patch 02
- current source code, tests, migrations, and Changed Files reports

If an older document names a stylesheet that the current ownership map says was deleted, the current source tree plus `CSS_OWNERSHIP_MAP.md` wins. Do not restore deleted compatibility files.

## Hard scope boundary

Phase 09 may:

- fix release-blocking visual, interaction, responsive, theme, accessibility, or regression defects;
- repair stale project documentation that could cause incorrect future implementation;
- strengthen static/runtime regression checks;
- update build provenance and release-candidate reports.

Phase 09 must not:

- implement executor candidate matching;
- add executor availability/calendar persistence;
- create `JP -> RU -> EN` routing;
- auto-select/rank executors;
- change tariff/business logic without a proven regression;
- redesign accepted Phase 00-08 work merely for preference;
- add fake business data, ratings, percentages, notifications, or capacity signals.

## Owner-added Phase 09 defect — Dashboard KPI navigation arrows

The owner supplied a rendered Dashboard screenshot showing the navigation arrows under:

- `Новые заявки`
- `Активные заказы`
- `Сдать сегодня`
- `Просрочено`
- `Без исполнителя`
- `Ждут оплаты`

The arrows currently look accidentally attached to the lower-left/icon area rather than intentionally placed in the card grid.

Required result:

1. Keep the cards genuinely navigable.
2. Keep the arrow only as a navigation affordance; do not add helper copy back.
3. Move the arrow into a deliberate lower card zone, preferably the lower-right corner with a consistent inset.
4. Reserve layout space for the arrow so it cannot collide with value/label text.
5. The arrow must remain inside card bounds at desktop, compact/tablet, mobile, and zoom-equivalent widths.
6. Do not use arbitrary absolute offsets that fight a later generic selector. Fix the real cascade/layout cause.
7. Preserve keyboard focus, reduced-motion behavior, semantic tones, and Phase 08 smoked-glass treatment.
8. Verify equivalent KPI/summary card patterns were not regressed.

Russian UI labels above are canonical and must remain unchanged.

## Full Phase 09 acceptance sweep

### A. Global readability

Verify every route for comfortable operational typography. Do not shrink working copy to recover density. Large page/display titles should not be unnecessarily inflated.

### B. Interaction integrity

Verify:

- three-dot/action menus;
- outside click + Escape dismissal;
- tabs and `aria-selected` state;
- intended clickable cards and rows;
- buttons and links;
- dialogs/popovers;
- Settings module switching;
- Table/Kanban switching;
- pagination;
- file download/preview/source navigation.

No visual-only controls are allowed.

### C. Scroll and overflow

Verify natural wheel/trackpad propagation, no redundant page-level vertical rails, no accidental nested scroll traps, and document-bounded horizontal layout. Dense tables may scroll inside their owned wrapper.

### D. Executor language editing

Verify language direction rows retain stable input identity while typing and reuse the real language autocomplete dictionary. Do not remount an editable row after every character.

### E. Orders regression

Verify:

- command surface and filters;
- `Архив`;
- `Таблица / Kanban`;
- order open/close flow;
- 01-09 pipeline;
- `Основное / Работы / Финансы / Файлы / История`;
- work editing/duplication;
- multi-executor manual assignments;
- client payment;
- files/history;
- canonical Finance terminology;
- `Предварительный расчёт` remains client-facing and does not expose internal executor/profit data.

### F. Administrative workspaces

Verify Clients, Executors, Files, Users, Settings, Applications, Dashboard, Auth, and Imports without changing accepted information architecture.

### G. Theme matrix

Verify System / Light / Dark. No white islands, low-contrast legacy blue text, unreadable native controls, or color-only state communication.

### H. Responsive / zoom matrix

Target widths:

`320 / 360 / 375 / 390 / 430 / 620 / 768 / 900 / 1024 / 1180 / 1280 / 1440 / 1920`

Browser zoom acceptance:

`100 / 125 / 150 / 175 / 200 / 250%`

At high desktop zoom, use the reduced CSS viewport as compact/tablet/mobile. Do not compress desktop geometry beyond readability.

### I. State/content matrix

Cover:

- long Russian labels;
- long entity names;
- long filenames;
- empty;
- loading;
- error;
- disabled;
- focus-visible;
- hover;
- selected;
- archived where applicable.

### J. CRUD / contracts

Regression-check existing CRUD workflows and backend contracts. Phase 09 does not create a new business API unless a release-blocking defect proves it necessary.

## CSS ownership

Current canonical ownership:

- shell -> `phase1-shell.css`
- shared controls -> `phase2-ui-kit.css`
- Clients/Executors -> `phase4-directories.css`
- global owner readability -> `owner-readability.css`
- Orders/pipeline/finance -> `phase5-orders.css`
- Files/Users/Settings -> `phase6-admin.css`
- Phase 08 premium metric/motion treatment -> `phase8-visual-motion.css`
- token values -> `crm-foundation.css` (last)
- `legacy-visual-core.css` -> compatibility only; no new feature rules

For a Phase 09 defect, patch the canonical owner of the defective semantic pattern. Do not create a `phase9.css` override layer merely to win specificity.

## Verification order

Run and report only checks that actually execute:

1. repository/source pre-flight;
2. CSS parse;
3. foundation audit;
4. CSS ownership audit;
5. Phase 08 owner regression audit;
6. Phase 09 release-candidate audit;
7. TypeScript syntax/typecheck when dependencies permit;
8. lint when dependencies permit;
9. production build when dependencies permit;
10. backend compile/tests when dependencies permit;
11. Alembic single-head check;
12. targeted Playwright;
13. full critical Playwright regression;
14. Light/Dark viewport/zoom visual QA.

If a dependency/runtime is unavailable, mark that check as NOT RUN. Never convert static inspection into a claimed runtime pass.

## Release-candidate output

Deliver:

- a new Phase 09 build ID;
- minimal coherent source patches only;
- `CHANGED_FILES_PHASE_09.txt`;
- `PHASE_09_IMPLEMENTATION_REPORT.md`;
- Phase 09 QA specification/checklist;
- updated regression tests/static audit where useful;
- ZIP without `node_modules`, `.next`, Playwright artifacts, caches, or secrets;
- exact PowerShell commands for the changed scope.

Do not begin Phase 10 until the owner accepts the Phase 09 release candidate.
