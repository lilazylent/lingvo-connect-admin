# Phase 06 — Files + Users + Settings

Status: implemented in Phase 06 candidate; awaiting owner visual/runtime acceptance  
Baseline: Phase 05 Orders + owner review fixes  
Global contracts: `docs/CRM_MVP_MASTER_SPEC.md`, owner video-review supplements, approved Phase 00–05 baselines

## Purpose

Consolidate the remaining administrative workspaces into the same compact CRM system instead of three separate legacy mini-apps. Phase 06 owns Files, Users and Settings. It also prepares canonical data foundations needed by the future executor-matching workflow, but **does not implement automatic matching/routing**. That workflow is post-MVP and remains after Phase 09.

## Cross-phase prerequisites

Before Phase 06 is accepted, previously approved pages must keep their Phase 00–05 behaviour. Obvious regression debt from owner review is fixed at the owning page rather than hidden inside Phase 06:

- no useless permanently visible scrollbars in side-detail cards;
- no protruding burgundy accent lines;
- Application full-detail header/status/actions use one compact grid;
- Order pipeline active state, Work typography/identity and compact Finance remain readable in Dark;
- Order files have real open/download actions;
- New Order calculation fields do not contain dark-blue text, clipped labels or white legacy separators.

Phase 06 may consume shared fixes but must not redesign Dashboard, Applications, Clients, Executors or Orders without an explicit regression reason.

## Files workspace

Build a real operational file workspace backed only by existing file/document APIs.

### Header and summary

- page title/subtitle;
- compact real summary values only when supported by backend;
- primary upload action;
- CSV/XLSX export only where an existing export contract exists.

### Command bar

One compact command surface with available real filters:

- search;
- file type;
- source/entity type;
- client;
- order;
- date;
- archive/state if supported.

Do not create dead filter controls for fields the API does not support.

### File list + selected file

Desktop uses list/table + selected-file detail. Selected detail must expose, where supported:

- filename/type/size/date;
- uploader/source;
- linked application/client/order/work;
- `Открыть / Просмотреть` when the format/endpoint supports it;
- `Скачать` using the real download endpoint;
- `Перейти к источнику` using the real CRM relation.

Do not turn MVP Files into a Google-Drive clone.

### Known owner-review defects owned by Phase 06

- remove white `Скачать` buttons in Dark;
- replace remaining dark-blue low-contrast file text with semantic text tokens;
- remove white separators/light islands in Dark;
- keep arrow/download icons inside control bounds at all viewport widths;
- outside-click/Escape closes file menus/popovers;
- no visual scrollbar unless it communicates a genuinely scrollable local area.

## Users workspace

Use the same shared list/detail pattern as other directories.

Backed data only:

- name/email;
- role;
- active status;
- 2FA;
- last activity/login when available;
- access/permissions only when exposed by backend;
- selected-user detail and real actions.

### Menu and destructive-action contract

- three-dot menus must be viewport-aware;
- menus must not render outside the viewport or underneath clipping containers;
- prefer shared popover/menu positioning instead of page-local offsets;
- outside click + Escape closes the menu;
- destructive actions require a clear confirmation pattern;
- ADMIN/MANAGER badges stay on one shared component with no white inset/stripe.

## Settings workspace

Settings is one modular system, not a collection of visually unrelated screens.

Required modules from the MVP spec:

- Справочники;
- Тарифы;
- Скидки и коэффициенты;
- Оформление;
- Услуги и единицы;
- Статусы заказов.

Every module follows one UX contract:

`module header -> toolbar -> table/list -> drawer/modal editor`

No module invents its own buttons, table geometry or editor shell.

## Phase 10 foundation prepared in Phase 06

Phase 06 must establish or verify the canonical dictionaries that later matching depends on. It must **not** implement candidate matching or translation routing yet.

### Canonical service dictionary

Order work service and executor supported service/specialization must resolve to the same canonical service record/identifier. Do not compare unrelated free-text labels such as separate copies of `Письменный перевод`.

Until all operational references are migrated from string codes to foreign keys, an existing `ServiceType.code` is a stable business key and must not be renamed in place. Create a new service code and migrate explicitly instead of silently orphaning tariffs, works, pricing rules or executor capabilities.

If the current backend already exposes a canonical service/settings dictionary, reuse it everywhere. If it does not, document the backend gap explicitly instead of faking matching in the frontend.

### Canonical language dictionary

All language selectors reuse the real language dictionary. Executor pairs and Order work source/target selectors must share the same language identifiers/labels.

Current operational tables still persist the language name rather than a language FK. Therefore an existing language name is treated as a stable business key in Phase 06: admins may change availability/order, but renaming requires creating a new language and an explicit future migration of existing records.

### Executor capability model readiness

The UI/data contract must be capable of representing:

- executor;
- supported service;
- language pair;
- default rate and rate unit when supported;
- multiple pairs/services per executor.

Per current owner requirement, a stored executor language pair is treated as bidirectional by default (for example JP↔RU matches JP→RU and RU→JP). A future explicit one-way limitation would be a new contract and must not be assumed now.

### Executor rate readiness

Where a default executor rate already exists, Settings/Executor editing should expose it consistently so Phase 10 can auto-fill assignment rate. Assignment-specific rate remains overridable later.

### Availability/calendar

Do **not** build executor availability matching in Phase 06. Calendar/availability (`free`, `busy until`, `vacation`, etc.) is part of the post-MVP matching feature. Phase 06 should avoid architecture that would make such data impossible to attach later.

## Theme / typography / responsive

- global enlarged working typography remains the baseline;
- large display/page titles are not multiplied;
- all new Phase 06 surfaces use semantic `--crm-*` tokens;
- visible Phase 06 Dark defects are fixed now; exhaustive cross-route Dark QA remains Phase 07;
- no document-level horizontal overflow;
- popup/menu bounds are tested at desktop, zoomed tablet widths and mobile;
- density is recovered by grid/spacing, never by shrinking text back to unreadable sizes.

## Acceptance criteria

1. Files is a functional list/detail workspace, not a plain legacy table.
2. Real open/download/source actions work where backend contracts exist.
3. Users menu/popover never becomes unreachable outside viewport/clipping.
4. Users, Files and Settings use shared controls and one visual system.
5. Settings modules share one list/editor pattern.
6. Service selectors used by Orders and Executors share one canonical source of truth, or a backend gap is explicitly documented.
7. Language selectors share the real language dictionary.
8. No automatic executor matching/routing is implemented in Phase 06.
9. No fake data is introduced to simulate future matching.
10. Phase 00–05 regression gate remains green.
11. No new `!important` declarations.
12. Foundation remains the final CSS import.

## Deferred

- exhaustive Dark Theme audit -> Phase 07;
- premium motion/EFX -> Phase 08;
- full MVP functional/zoom/release QA -> Phase 09;
- executor candidate matching, availability calendar and translation routing -> post-MVP Phase 10 (`docs/post-mvp/PHASE_10_EXECUTOR_MATCHING_ROUTING.md`).


## Implementation snapshot — Phase 06 candidate

Implemented on top of the accepted Phase 05 baseline:

- Files is now an operational list/detail workspace with real CSV/XLSX export, upload into an existing Order/Application, safe browser preview for PDF/image/text formats, download and source navigation. The registry remains backed by the existing file relations rather than inventing a global file store.
- Users now uses the same split-workspace pattern and the shared viewport-aware `ActionMenu`. Row actions are rendered in a portal, clamp to the viewport, open upward when needed and close on outside click/Escape.
- Settings now exposes exactly the six MVP modules: `Справочники`, `Тарифы`, `Скидки и коэффициенты`, `Оформление`, `Услуги и единицы`, `Статусы заказов`. Editors share the existing dialog/control system.
- A persisted `language_catalog` is introduced. It is seeded only from existing database language values plus the already-required Russian pivot language; no fabricated ISO catalogue is injected. Existing selectors continue to use language names, now from one canonical source.
- Executor capabilities now store a canonical CRM service code in the legacy `work_type` field, plus `default_rate` and `rate_unit`. Existing legacy capability codes can be preserved during editing but new capabilities must select a canonical `ServiceType`.
- Executor editing uses the same `/crm/services` and `/crm/languages` dictionaries as Order/Tariff flows. Default executor rates are visible/editable but do not trigger any automatic assignment.
- Tariff language fields reuse `LanguageCombobox`; the Settings language dictionary can be edited by ADMIN.
- Order file cards gained real Open/Download actions where the format supports preview.
- Owner-review shared regressions consumed by this phase: hidden-but-functional detail scrollbars, restrained gradient page rules, denser Application status/action grouping, and consistent semantic surfaces for the touched admin areas.

### Database change

Migration `0017_phase6_catalogs` is required. It creates `language_catalog` and adds `default_rate` / `rate_unit` to `executor_directions`. This means Phase 06 is **not** a frontend-only update.

### Explicit non-goals preserved

Phase 06 does not choose executors, build JP→RU→EN routes, rank candidates by availability or create an executor calendar. Those behaviours remain post-MVP Phase 10 after Phase 09 acceptance.
