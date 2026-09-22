# Phase 05 — Orders + Order detail

Status: implemented + owner review fix applied, local visual acceptance pending  
Baseline: Phase 04 Clients + Executors  
Global contracts: `docs/CRM_MVP_MASTER_SPEC.md`, `docs/OWNER_VIDEO_REVIEW_REQUIREMENTS_2026-09-15.md`

## Purpose

Turn Orders into a dense operational workspace and rebuild the order detail so it no longer behaves like one oversized vertical document. Preserve the existing backend and all production logic for works, tariffs, discounts, urgency, multiple executors, payments, files and history.

## Shared regressions included before Phase 05 page work

These owner-video items are global and cannot wait until later phases:

- working/micro UI typography enlarged roughly 1.5x from the former 9–13px implementation while large page titles remain on the existing title scale;
- sidebar subtitle changed to `АДМИН-ПАНЕЛЬ` and aligned to the wordmark right edge;
- executor language-direction row identity stabilized so typing no longer remounts the input after every character;
- executor source/target language fields now reuse the existing real-language autocomplete endpoint;
- Phase 04 detail scroll changed from a narrow nested scroll trap to a full-card local scroll surface.

These are shared regression patches, not permission to redesign frozen Phase 01–04 compositions.

## Orders list contract

### Header / metrics

Keep existing real metrics and `Новый заказ` action. No fake KPIs.

### Command surface

One compact command surface contains:

- search by order/client/title using the existing query contract;
- status;
- language;
- executor using existing `/api/admin/executors` lookup and `executor_id` order filter;
- deadline state;
- payment state;
- `Архив` + `Таблица / Kanban` grouped together on one edge, with no dead middle gap.

### Table

The table exposes only backend-backed values:

- order number;
- client + title;
- deadline;
- status;
- paid/debt state from the existing financial summary;
- open action.

### Kanban

Kanban remains backed by real order statuses and the existing status PATCH endpoint. Cards may show:

- order number/title;
- client;
- deadline;
- debt when available.

No invented progress percentage, priority score or rating.

## Order detail contract

### Header

Compact order number/title/deadline with edit + close actions.

### Pipeline

Keep the real configured order statuses. Current/past/future states must remain visible and status changes continue through the existing endpoint. The pipeline may horizontally scroll on reduced CSS width instead of compressing labels into unreadable text.

### Navigation

Use real accessible tabs:

- Основное
- Работы
- Финансы
- Файлы
- История

Only the active working section is shown. This is the main mechanism that removes the old giant vertical document.

### Основное

Real client, contact, manager, deadline, created date and internal note. Existing edit contract is preserved.

### Работы

Each work remains a production unit and exposes real:

- service;
- language direction;
- volume;
- urgency/native-speaker flags;
- status;
- executor(s);
- deadline;
- client tariff/price;
- executor cost.

Existing create/edit/duplicate/archive and multi-executor assignment logic remains reachable.

### Финансы

Hierarchy uses existing `financial` fields:

- order revenue / total;
- client debt / payment state;
- profit;
- margin;
- executor cost.

Existing client payment editing stays in this tab.

The preliminary client estimate remains available but becomes a collapsed utility. It must never expose internal executor costs, profit or staff notes.

### Файлы

Existing order file upload/analysis and metadata remain reachable. No Phase 06 file-workspace redesign is pulled forward.

### История

Use the existing `OrderRecords` activity endpoint as one chronological history view. No duplicate timeline.

## Responsive / density

- New Phase 05 work follows 1180 / 900 / 620 / 430 breakpoints.
- Internal tables / Kanban may scroll horizontally inside their own surfaces; document-level horizontal overflow is not allowed.
- Density must be recovered through spacing/grid, not by shrinking working copy below the owner readability scale.
- At <=620px, filters stack, actions stay reachable, tabs/pipeline may scroll horizontally, and order sections become one-column.

## Theme

Visible Order-owned Dark defects are Phase 05 defects. All new Phase 05 surfaces use semantic `--crm-*` tokens. The product-wide exhaustive Dark pass remains Phase 07.

## Acceptance criteria

1. `Архив` and `Таблица / Kanban` are one compact grouped view-control area with no large dead gaps.
2. Executor filtering uses an existing backend contract; no fake filter UI.
3. Order list shows real client/payment context where available.
4. Kanban drag/status change still calls the existing status endpoint.
5. Order detail uses real `role=tab` controls and only the active section is visible.
6. Preliminary calculation is collapsed by default and contains no executor/profit/internal figures.
7. Existing work create/edit/duplicate/archive, multi-executor, payment and upload code paths remain reachable.
8. Shared readability scale is visible on labels/table/body copy; large page title scale is not multiplied.
9. No new `!important` declarations.
10. Foundation remains the final CSS import.
11. No backend/database/Alembic changes.
12. Phase 01–04 pages are not compositionally redesigned by the shared regression patch.

## Deferred

- Files / Users / Settings full consolidation -> Phase 06.
- Exhaustive cross-route Dark audit -> Phase 07.
- Public-site-inspired motion / hover EFX -> Phase 08.
- Full transcript regression, browser zoom and release-candidate QA -> Phase 09.


## Owner review fix gate (2026-09-15 15:08)

Before Phase 06, Phase 05 also owns the fixes in `docs/OWNER_PHASE05_REVIEW_FIX_2026-09-15.md`: tighter public-site-like branding alignment, outside-click application action menu, semantic application-detail colors, application header alignment, clipped/gradient decorative accents, aligned work identity rows and a more compact finance summary.

The review explicitly accepts the global readability scale, Table/Kanban direction, executor workspace concept and collapsed preliminary client estimate; those decisions are regression-frozen.
