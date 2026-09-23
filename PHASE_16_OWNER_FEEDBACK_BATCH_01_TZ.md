# Phase 16 — Owner Feedback Batch 01

## Goal
Apply the first production feedback batch from Oleg without regressing the current CRM grid, mobile behavior, authentication, pricing, deposits, matching, or production deployment.

## Global implementation rules
- Work from the latest code state; never reintroduce stale RC behavior over newer production fixes.
- One layout defect means checking the equivalent pattern across the CRM, not patching one isolated screen.
- Responsive verification targets: desktop, ~1280px, ~1024px/tablet, ~768px, ~390px/mobile.
- No page-level horizontal overflow. Tables may scroll inside their own container when necessary.
- Roles/permissions are a major architectural change and are implemented as the final functional block, not between unrelated UI fixes.
- Preserve the existing ADMIN account, 2FA, sessions/data model, client deposits, matching and order workflows.

## 16.1 Base urgency and tariff cleanup
- Canonical base urgency coefficient is x1.0.
- A higher urgency coefficient belongs to a concrete work item and is only applied when explicitly enabled/selected.
- Tariffs no longer expose a base urgency field in Settings.
- Existing default tariff/work values of x1.5 are normalized to x1 where they represented the previous default.
- Tariff editor becomes service-driven: language/direction/native controls appear only when relevant to the selected service definition; billing units follow the service definition.

## 16.2 Order numbering
- Canonical public order number format: `YY-NNNN`, e.g. `26-0001`.
- Preview is read-only and does not consume a number.
- Real number is reserved only during successful creation.
- Year sequence still resets each year.
- Existing `YY-0-NNNN` numbers are normalized safely.

## 16.3 Orders list and global responsive grid
- Orders filter row must never escape the viewport; at narrower widths it wraps to 3/2/1 columns.
- Search remains visually dominant.
- Archive/Table/Kanban controls wrap cleanly.
- Equivalent CRM toolbars, tables, dialogs and grids are checked for the same shrink/overflow failure pattern.
- Mobile hardening covers auth/register/2FA, safe areas, tables, dialogs, wizard navigation and shared page surfaces.

## 16.4 Work form information architecture
For written translation, desktop/tablet rows are:
1. Service | Character count
2. Source language | Auto page count
3. Target language | Topic
4. Deadline date | Translator type
5. Deadline time | Work status

On mobile the same fields collapse to one readable column.

Translator type copy is explicit:
- `Обычный переводчик`
- `Носитель языка`

Helper text explains that a native speaker affects executor matching and tariff calculation.

## 16.5 Calculation step readability
- The tariff calculation row uses content-aware widths rather than five equally squeezed columns.
- Tariff and billing unit get more space; numeric/manual fields remain compact.
- `Усл. страница / 1800 знаков` and auto-calculation state must be fully readable.
- At narrower widths the calculation row wraps to 3/2/1 columns rather than truncating text.

## 16.6 Payment method simplification
New/edit order payment method is a controlled select only:
- `Наличные` (`cash`)
- `Безналичный расчёт` (`cashless`)
- `Депозит` (`deposit`)

This field is classification only in this phase. It does not introduce new accounting side effects or automatic deposit deduction beyond the already existing deposit ledger behavior.

## 16.7 Roles and permissions — final major block
- Keep protected system `ADMIN` with full rights.
- Keep `MANAGER` as a system operational role with ordinary CRM permissions.
- Add editable custom role definitions stored in DB.
- Admin can create a role, rename it, choose permissions, assign it to users/invitations and delete an unused custom role.
- System roles cannot be deleted; ADMIN cannot be weakened.
- Last active ADMIN protection remains.
- Permissions are module-level and explicit: Overview; Applications view/edit; Clients view/edit; Orders view/edit; Executors view/edit; Files view/edit; Users/Roles; Settings/Tariffs; Imports.
- Backend enforces permissions; frontend navigation only mirrors server authority.
- Invitation flow supports dynamic roles and displays the human role name.

## 16.8 Deployment integrity fixes retained in source
- Long Alembic revision IDs are supported by expanding `alembic_version.version_num` before historical long revisions.
- Beget override keeps CRM PostgreSQL unambiguous (`crm-postgres`), exposes API/frontend to the existing Caddy network as `admin-api` / `admin-web`, and forces Next.js to listen on `0.0.0.0:3000`.

## Acceptance criteria
- Base urgency produces x1 pricing; explicit x1.5 still produces +50% when selected on a work item.
- Tariff settings do not show base urgency x1.5 and hide irrelevant language controls for service-only services.
- New order preview and created order show `26-0001` format.
- Orders filters and calculation row remain readable at tablet width and do not create page-level overflow.
- Written-translation fields follow Oleg's requested grouping.
- Payment method is limited to the three approved values.
- Custom roles can be created/assigned and forbidden API access returns 403.
- ADMIN remains protected.
- Mobile auth and shared CRM patterns respect safe areas and viewport width.

## Owner Patch 02 — Order identity cleanup
- Orders do not have a separate user-facing name/title. The only canonical order identifier is the generated public order number (`YY-NNNN`).
- Remove `Название заказа` from creation and edit flows and remove `Без названия` / `Заказ без названия` fallbacks.
- Order lists, Kanban, dashboard, client-related orders, files and search use order number plus contextual client/status/deadline data instead of a title.
- Order search is number/client/executor based; it no longer searches a legacy title.
- Spreadsheet order import no longer requires or maps `Название заказа`; CRM assigns the order number automatically.
- Keep the legacy DB `orders.title` column only for backward compatibility; new internal values mirror the generated order number and the field is not exposed as a user concept.
- Apply the global pattern rule: removing a field in one order screen requires checking all semantic-equivalent order surfaces.
