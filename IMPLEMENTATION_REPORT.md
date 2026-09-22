# Lingvo Connect Admin — Motion + Order Workspace + Files v2

## Scope
This iteration continues from the accepted dark-theme/order-workspace v1 baseline. It does not replace the CRM architecture. It tightens the order workflow, adds an accessible motion/FX layer, and turns the previously planned **Файлы** route into a working document registry with real backend data and spreadsheet exports.

## 1. Motion / FX system
Added `apps/admin-web/src/app/motion-system.css` and loaded it after the product/theme layers.

Applied rules:
- High-frequency feedback is short (about 100–150 ms); popup/dialog/page context motion is still brief (about 170–250 ms).
- Motion is reserved for feedback, state changes and spatial context: navigation, buttons, inputs, dropdowns, dialogs, toasts, rows and status stages.
- Perpetual legacy decoration (ambient orbiting / recurring shine / looping accent effects) is disabled so the working CRM does not constantly compete for attention.
- Large operational cards do not bounce on hover; clickable rows and controls use only restrained 1–2 px feedback.
- The dark workspace keeps static depth/edge accents so it is not visually flat without becoming a “demo landing page”.
- `prefers-reduced-motion: reduce` collapses non-essential motion while preserving states and information.

Research basis used for the implementation: Atlassian Design System Motion, Apple HIG Motion / Reduced Motion, Nielsen Norman Group guidance on purposeful UI animation, and W3C/WCAG motion-accessibility guidance.

The permanent project rules in `apps/admin-web/AGENTS.md` now include the motion protocol.

## 2. Order workspace v2
`apps/admin-web/src/components/crm-orders.tsx` and `apps/admin-web/src/app/order-deal-redesign.css` were refined around the translation-production workflow.

Changes:
- Finance is no longer five equal boxes. **Итого заказа** and **Осталось оплатить** are the primary commercial signals; profit, margin and executor cost are secondary management metrics.
- Debt and paid states have distinct semantic treatment in both light and dark themes.
- Work rows were rebuilt as production cards: service, language direction, volume, urgency/native-speaker flags, work status, executor, deadline, client rate, client total and executor cost are readable as one operational unit.
- Existing edit / duplicate / archive actions remain available; business logic and existing work APIs are preserved.
- Order history was removed from the narrow side rail and placed as a full-width single-column timeline under the operational area.
- The side rail remains focused on payment and compact supporting information.
- Status pipeline remains a first-class navigation/control surface but its hierarchy is calmer: past/current/future states do not compete equally.
- Responsive rules were hardened against the legacy order-table selectors so the new work-card layout remains visible at tablet/mobile breakpoints instead of being hidden by old CSS.

No new order database migration was introduced.

## 3. Files module (Phase 5 foundation)
The old placeholder `/admin/files` is now a real central document registry.

### Frontend
Added `apps/admin-web/src/components/crm-files.tsx` and `apps/admin-web/src/app/files-workspace.css`.

The module provides:
- one registry for files attached to **orders and applications**;
- search by filename, order/application number and record title;
- filters by source and file kind (PDF, document, spreadsheet, presentation, image, other);
- summary metrics for current result set;
- direct link back to the source order/application;
- secure direct download through the existing authenticated file endpoints;
- pagination;
- responsive desktop table / mobile cards;
- light/dark styling using the semantic theme tokens;
- CSV and XLSX registry export using the active filters.

The sidebar no longer marks **Файлы** as “Позже”.

### Backend
Extended `apps/api/app/routers/operations.py` with:
- `GET /api/admin/files`
- `GET /api/admin/files/export.csv`
- `GET /api/admin/files/export.xlsx`

The registry is a read-only union of the existing `order_files` and `application_files` records. Existing storage/download security remains the source of truth; no second storage system or duplicate file table was introduced.

CSV is UTF-8 with BOM and semicolon delimiters for convenient Russian Excel opening; user-controlled cells that could be interpreted as spreadsheet formulas are neutralized on CSV export. XLSX is generated as a minimal standards-compliant OOXML workbook with a frozen header and autofilter, without adding another runtime library solely for export.

Important product interpretation: Excel/XLSX exports the **file registry and metadata**, not the binary contents of PDF/DOCX/etc. Actual documents remain downloadable from their secured storage endpoints.

## 4. Tests / verification actually run
### Passed
- `python -m py_compile` / import-level syntax checks for the modified API code.
- Targeted API suite: `pytest -q tests/test_operations.py` — **3 passed**.
- The API test creates both an order file and an application file, verifies unified registry/filter/search, CSV export, and opens the generated XLSX with `openpyxl` to verify workbook contents.
- TypeScript parser-level transpilation succeeded for modified TS/TSX including the Files module, order workspace, shell/layout and updated Playwright spec.
- CSS parsing succeeded for theme/order/files/motion styles.
- New v2 styles contain no `!important` overrides.

### Not fully runnable in this container
A complete frontend `npm ci` did not complete in the available container session, so a real project `npm run typecheck`, `npm run lint`, Next production build and Playwright browser run were **not** claimed as passed here. The Playwright fixture was updated to cover the real Files registry/export links and existing reduced-motion visual checks, but it must be executed in the user's normal Docker/dev environment.

## 5. Data safety
- No destructive database operation.
- No volume deletion.
- No replacement file storage.
- No order/client/application schema migration.
- Existing uploaded documents continue to use their current storage keys and authenticated download routes.
