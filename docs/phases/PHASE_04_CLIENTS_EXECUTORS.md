# Phase 04 — Clients + Executors

Date: 2026-09-15  
Baseline: Phase 03 Dashboard + Applications  
Status: implementation phase

## Purpose

Rebuild the Clients and Executors modules as real compact split workspaces. The list must remain scan-friendly and dense; the selected record must expose real operational context without turning the page into a long vertical document.

This phase implements the Phase 04 slice of `docs/CRM_MVP_MASTER_SPEC.md` and the owner's original 26-point specification. It does not create business data that the current API does not contain.

## Clients contract

### List

Show only real data from the existing directory and CRM summary APIs:

- client/company name and type;
- email/phone/INN where available;
- order count and active-order count;
- revenue and current debt;
- active/archive state.

The list may derive summary columns through the existing `/api/admin/crm/clients/{id}/summary` endpoint. No new backend endpoint is introduced in this phase.

### Selected client

The right workspace provides real interactive tabs:

- **Обзор** — company/individual type, email, phone, INN, CRM totals, notes;
- **Контакты** — existing representative CRUD through the existing contacts API;
- **Заказы** — real recent orders and links to the current Orders workspace;
- **История** — real company activity.

Language pairs are shown only when they can be derived from real order works through the existing order-work endpoint. Tags are not rendered because the current backend has no client-tag model.

## Executors contract

### List

Show only real directory/summary data:

- executor identity and contact;
- language directions and real specializations;
- active/completed workload;
- amount currently owed;
- active/archive state.

### Selected executor

The right workspace provides real interactive tabs:

- **Обзор** — contacts, CRM totals, specializations, notes;
- **Направления** — real language pairs and work types;
- **Работы** — real executor assignments, rates, accrued cost, deadline/status and links to the related order;
- **История** — real executor activity.

Do not invent rating, experience, default tariff/rate, capacity percentage or other fields not present in the backend. Assignment-specific rates are allowed because they are real stored data.

## Layout and responsive rules

- Desktop: compact list + sticky selected detail/editor.
- 1180 px and below: reduce non-critical table columns before compressing text below readability.
- 900 px and below: one-column workspace; detail/editor moves before the list.
- 620 px and below: selected detail/editor becomes a full working overlay below the topbar.
- Table overflow is controlled inside the table surface; document-level horizontal overflow is not allowed.
- All page-specific text/surfaces use Phase 0 semantic tokens. Visible Dark contrast defects on Clients/Executors are Phase 04 defects, not deferred to Phase 07.

## Editing and functional preservation

- Company/executor create, edit and archive/restore remain on the existing API contracts.
- Client representative CRUD remains available in the selected client workspace.
- Executor directions remain editable using the existing executor contract.
- No backend, database or migration change is allowed for this visual/consolidation phase.

## Acceptance criteria

1. Clients and Executors are genuine split workspaces rather than old full-width tables with a decorative side card.
2. Detail tabs are buttons with `role=tab`, visible focus and real state changes.
3. Client order/revenue/debt values come from the existing CRM summary endpoint.
4. Client language pairs are shown only when found in real order works.
5. Executor workload, assignment rate/cost and owed amount come from existing assignment/summary data.
6. No fake ratings, tags, experience, workload percentages, default rates or KPI values.
7. Create/edit/archive/contact management functionality remains reachable.
8. Light and Dark text/surfaces use semantic tokens and remain readable.
9. No new `!important` declarations.
10. Foundation remains the last CSS import.
11. 900 / 620 / 430 / 390 / 360 / 320 px must not gain document-level horizontal overflow from Phase 04.
12. Phase 01 shell, Phase 02 UI kit and Phase 03 Dashboard/Applications remain regression-frozen.

## Explicitly deferred

- Orders commandbar, Table/Kanban and order detail redesign -> Phase 05.
- Files, Users and Settings -> Phase 06.
- Exhaustive all-route Dark audit -> Phase 07.
- Public-site-inspired motion/EFX -> Phase 08.
- Final cross-product functional/visual QA -> Phase 09.
