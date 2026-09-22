# Phase 08 — Owner Review Patch 02

Date: 2026-09-16  
Build ID: `phase08-settings-concept-c-20260916-r1`

## Purpose

Finish Phase 08 against the owner's rendered screenshots instead of treating source-code presence as completion. This patch preserves accepted Phase 08 motion and fixes the owner-visible layout, readability and Settings regressions reported after the first Phase 08 build.

## Binding acceptance requirements

### Dashboard / summary cards
- Dashboard KPI cards use restrained smoked-glass surfaces, not generic neon glassmorphism.
- Semantic reflections/tints: wine, slate, amber, restrained red, teal and gold/wine.
- Remove filler/helper copy that caused overlap (`Новые обращения`, `Работа в процессе`, `0 за сегодня`, `Хорошо!`, `Требует назначения`, `Есть задолженность`).
- KPI hierarchy is pictogram → value → canonical title.
- A navigation arrow exists only where the metric is genuinely navigable and stays at one lower/right inset without colliding with text.
- Equivalent KPI cards across Applications, Orders, Clients/Executors and Users use the same clean structural contract.

### Shared page rhythm
- One semantic token controls the gap between PageHeader/description and the following KPI summary row.
- Applications, Orders, Clients/Executors and Users must not each invent their own margin.

### Working typography
- Application operational helper copy and save-state text must not inherit old 10–13px micro typography.
- The fix applies semantically to section descriptions, form hints/errors, save-state text and equivalent form helper copy across CRM screens.

### Client / Executor detail panel
- `Обзор / Контакты / Заказы / История` are the navigation.
- On desktop there is no second nested vertical scroll rail with up/down controls inside the preview card.
- Natural document scrolling remains; the existing mobile overlay behavior remains intact.

### Settings
- Module navigation and selected-module content are in one non-overlapping flow.
- Module navigation, module header/action and catalog content never overlap during scroll.
- Long real catalogs use compact search + page-size + pagination; no fake records.
- Services, Languages, Tariffs and pricing Rules are paged from the real arrays already loaded from the backend.
- `Оформление` content remains intact.

### Order pipeline
- Remove the old heavy/fat numeric bubble.
- 01–09 use a refined custom SVG dial with readable numeric center.
- The current state uses a thin circular progress stroke.
- The stroke starts at 12 o'clock and fills clockwise when the backend-confirmed current status changes.
- Completed stages display a full semantic success ring; future stages use a quiet track.
- `Готов`, `Выдан`, `Завершён`, `Отменён` remain readable in Dark.
- `prefers-reduced-motion` freezes decorative animation while preserving state clarity.

### Existing Phase 08 requirements retained
- Geometry-safe gloss instead of card lift.
- Dashboard finance-bar internal motion.
- Restrained wine/burgundy primary accent.
- Rounded global-search focus ring.
- Sidebar translation artwork with no fake action arrow.
- Dashboard `Слова соединяют мир.` translation artwork.
- Fixed Files source-badge geometry (`Заказ` / `Заявка`).
- Two-zone Order Finance workspace with `Предварительный расчёт` secondary utility.

## Architecture / cross-project rule

Every shared fix requires a repository-wide equivalent-usage search. A requirement is not complete because one screenshot-specific selector changed.

Canonical owners remain:
- shell: `phase1-shell.css`
- shared controls: `phase2-ui-kit.css`
- directories: `phase4-directories.css`
- owner readability: `owner-readability.css`
- Orders/pipeline/finance: `phase5-orders.css`
- Files/Users/Settings: `phase6-admin.css`
- Phase 08 motion/glass: `phase8-visual-motion.css`
- semantic token values: `crm-foundation.css`

The compatibility layer may only lose a legacy fragment when repository analysis proves that the fragment actively overrides an already-complete canonical owner. No new feature rules may be added there.

## Delivery gate

Before packaging:
1. run foundation audit;
2. run CSS ownership audit;
3. run Phase 08 owner static audit;
4. parse all app CSS;
5. run lint/typecheck/build when dependencies are available;
6. run targeted Phase 7/8 Playwright when the environment supports the project runtime;
7. remove `node_modules` and transient build artifacts from the ZIP;
8. validate ZIP integrity.

Never claim a check that did not actually run.
