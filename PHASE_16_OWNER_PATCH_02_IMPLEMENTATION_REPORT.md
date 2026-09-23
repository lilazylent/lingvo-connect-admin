# Phase 16 — Owner Patch 02 Implementation Report

## Owner correction
Oleg confirmed that orders do not have a separate user-entered name. The canonical order identity is the generated public number only (`YY-NNNN`).

## Implemented
- Removed `Название заказа` from the new-order wizard and order details editor.
- Removed `Без названия` / `Заказ без названия` fallbacks from order UI.
- Orders table now shows `Заказ` + `Клиент`; Kanban uses order number and client context.
- Order card heading is `Заказ <number>`.
- Dashboard recent orders now uses `№ / Клиент / Срок / Статус`.
- Client-related order lists no longer expose a title concept.
- Order file context no longer shows a hidden order title.
- Order search placeholder and backend search no longer use title; search is based on number/client/executor context.
- Spreadsheet order import no longer requires/maps `Название заказа`; CRM assigns the order number automatically.
- The legacy DB `orders.title` column is intentionally retained for backward compatibility. New internal order records mirror the generated number into it; it is not a user-facing field.
- Applied the global pattern rule: all semantic-equivalent order surfaces were checked instead of patching only the wizard.

## Build-regression fixes folded into this ZIP
The first Phase 16 package contained two TypeScript placement mistakes in `crm-settings.tsx` that were discovered during the user's local Docker build. This patch includes the corrected source:
- tariff-only service-driven variables live inside `TariffForm`;
- `ServiceForm` no longer references `allowedUnits` or tariff-only fields.

## Verification in this workspace
- Phase 16 static owner-feedback audit: **15/15 passed**.
- Python syntax compilation for API/tests: passed.
- TypeScript/TSX syntax transpilation: **61 files passed**.
- User-facing source scan: no `Название заказа`, `Заказ без названия`, or `Клиент / название` remains in application source.
- Backend source scan: no `Order.title.icontains(...)` search remains.
- Full Next production build was not rerun here because package installation is unavailable in this isolated environment. The two TypeScript errors previously encountered by the user are explicitly corrected in this package.

## Deployment from an already-running Phase 16 local environment
No new database migration is required for Owner Patch 02. Rebuild/restart only backend and frontend:

```powershell
docker compose up -d --build backend frontend
docker compose ps
```

If deploying from a version older than Phase 16, apply the existing Phase 16 migrations normally before testing the patch.
