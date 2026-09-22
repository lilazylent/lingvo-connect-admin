# Phase 09 — Final MVP QA + Release Candidate

Date: 2026-09-16  
Input baseline: `phase08-settings-concept-c-20260916-r1`  
Scope: final MVP regression QA and release-candidate stabilization only.

## Release principle

Phase 09 is a verification and stabilization phase, not a new product-feature phase. Every source change must correspond to a reproduced regression, a release-blocking defect, test hardening, or stale documentation that would direct future work incorrectly.

## Owner-added acceptance item

Dashboard KPI cards (`Новые заявки`, `Активные заказы`, `Сдать сегодня`, `Просрочено`, `Без исполнителя`, `Ждут оплаты`) retain their navigation links, but their circular arrow affordance must sit in a deliberate lower card zone instead of appearing attached to the icon/text cluster. The preferred layout is a lower-right grid-aligned footer position with space reserved inside the card.

## Product-wide acceptance checklist

- Auth/login remains readable in Light/Dark.
- Dashboard KPI/finance/recent lists/quick actions remain operational.
- Applications list/detail tabs/actions/files remain operational.
- Clients list/detail/tabs/representatives remain operational.
- Executors list/detail/directions/language entry remain operational.
- Orders list/filter/Table/Kanban and order detail tabs remain operational.
- Work editing, manual multi-executor assignments, payments, files, and history remain operational.
- Files registry upload/download/preview/export/source navigation remains operational.
- Users actions and viewport-aware action menus remain operational.
- Settings six-module architecture, real catalogs, pagination, theme controls, and status editing remain operational.
- Imports remain reachable for authorized users.
- No document-level horizontal overflow at supported responsive states.
- No redundant nested vertical scroll traps in accepted workspaces.
- System/Light/Dark use the same semantic information hierarchy.
- `prefers-reduced-motion` preserves state without decorative motion.
- Long Russian text, long filenames, empty/loading/error/disabled/focus/hover/selected states remain readable.
- Backend/Alembic remain unchanged unless a proven release regression requires otherwise.
- Phase 10 matching/calendar/routing remains absent from MVP source.

## QA matrix

Widths: 320, 360, 375, 390, 430, 620, 768, 900, 1024, 1180, 1280, 1440, 1920.  
Zoom: 100%, 125%, 150%, 175%, 200%, 250%.  
Themes: System, Light, Dark.

## Required evidence categories

1. Static architecture/audit checks.
2. CSS parse and ownership checks.
3. Frontend type/lint/build when dependency runtime is available.
4. Backend compile/tests and Alembic graph checks where available.
5. Playwright regression where frontend runtime is available.
6. Manual rendered Light/Dark and responsive/zoom review before owner freeze.

A check is never marked passed unless it actually ran.

## Owner review addendum 03 — 2026-09-16

This release-candidate pass also includes three owner-reproduced defects:

- Cancelled orders must be discoverable in `Архив`. Order status options are separated into `MAIN` and `ARCHIVE` boards; `CANCELLED / Отменён` is the default archive stage, and custom archive reasons may be created in `Настройки -> Статусы заказов` without appearing in the main workflow.
- The order action menu exposes `Добавить в архив` / `Вернуть в основную воронку`. Archive status changes remain available inside the archive workflow.
- In the Finance tab, `Для клиента / Предварительный расчёт` aligns with the first metric row (`Итоговая стоимость заказа`) on desktop rather than with the finance section heading.
- In the Files tab, the filename/metrics/status/actions row keeps `Открыть` and `Скачать` on the same horizontal row at desktop widths; narrow screens may use bounded local horizontal scrolling instead of inflating the row vertically.

General user-created named pipelines analogous to Bitrix24 remain a documented post-MVP expansion and are not implemented by this owner patch.
