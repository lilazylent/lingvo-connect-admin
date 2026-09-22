# Lingvo Connect Admin — Master Prompt: Full Dark Theme + Order Card Redesign

## ROLE
Work as a senior product designer + senior frontend engineer + pragmatic backend integrator for an operational translation-company CRM. Treat the current repository as the only source of truth. Do not redesign from memory and do not invent APIs or fields that do not exist.

## PRE-FLIGHT — MANDATORY
Before changing code:
1. Re-read the current `apps/admin-web` layout, global CSS, workspace CSS, theme loader, shared UI components, settings/theme controls, auth screens, all admin modules, order components, relevant types, API client and existing E2E tests.
2. Inspect the order API/model endpoints and confirm which fields already exist. Preserve business logic, calculations, tariffs, statuses, permissions, files, payments and activity history.
3. Identify duplicate/hard-coded light colors, conflicting selectors and component-level theme leaks. Fix at the semantic source when possible; do not stack arbitrary `!important` patches.
4. Inspect the supplied reference video as a UX reference, not a pixel-copy target. Its useful pattern is: compact deal header -> visible stage pipeline -> section navigation -> structured information rail -> large operational workspace/activity area.
5. Make an internal plan of touched files, risks, acceptance criteria and checks before editing.

## TASK A — PRODUCT-WIDE DARK THEME
Implement a complete, production-grade dark theme across the entire admin product, from anonymous authentication/recovery screens to the smallest CRM controls.

### Theme architecture
Use semantic roles, not random component hex values:
- canvas / app background
- shell / sidebar / topbar
- base surface
- raised surface
- hover/selected surface
- subtle and strong borders
- primary / secondary / muted text
- brand accent + hover + soft tint
- success / warning / danger / info + soft surfaces
- focus ring

Dark mode must be neutral graphite/charcoal. Do NOT tint the whole product blue/teal/green. Lingvo burgundy/pink is an accent, not a page background.

### Required coverage
Audit and verify all visible states of:
- login, password change/recovery, 2FA/TOTP/recovery-code UI
- sidebar, topbar, breadcrumbs, user menu, mobile sidebar/scrim
- dashboard metrics and finance blocks
- applications list/detail/create forms
- clients, translators/executors, users, files/imports
- orders list, kanban, create wizard and order card
- settings modules, tabs/subtabs, dialogs and appearance picker
- all cards/panels/tables/rows/empty states/notices/toasts
- inputs, textarea, date/number fields, custom selects, comboboxes, menus, popovers
- upload areas and native file-selector buttons
- buttons: primary/secondary/quiet/danger + hover/active/focus/disabled/loading
- badges/statuses/success/warning/danger/info states
- activity timelines, file rows, links, pagination
- modal/dialog backdrops and close controls
- browser autofill, placeholders, native dark form chrome and scrollbars where practical

### Non-negotiable dark-theme acceptance
- No accidental white/light panel may remain in dark mode.
- No light text may become unreadable on a light surface.
- No dark text may become unreadable on a dark surface.
- Normal text contrast must target WCAG AA >= 4.5:1; relevant large/non-text UI >= 3:1.
- Muted text must still be legible.
- Focus states must remain obvious.
- Color must not be the only state indicator.
- System/Light/Dark behavior must remain deterministic and persistent with no visible wrong-theme flash where avoidable.
- Do not regress light theme.

## TASK B — ORDER CARD COMPLETE INFORMATION-ARCHITECTURE REDESIGN
Redesign the order card into a mature deal workspace suited to a translation company.

### Reference principles from video
Use the reference conceptually:
- compact identity header
- immediately visible deal/order stage pipeline
- compact navigation between major areas
- clear left/right information hierarchy
- activity/history treated as first-class operational information
- dense but calm SaaS spacing; no giant decorative gaps

Do NOT copy another CRM's branding or irrelevant business concepts.

### Lingvo-specific order structure
The order card should make the following understandable at a glance:
1. Order identity: number, title, deadline, current stage.
2. Pipeline: all configured order statuses, current stage obvious, earlier stages visually distinct, statuses changeable using existing endpoint.
3. Core context: client, contact, responsible manager, deadline, created date, internal note.
4. Order economics: client revenue, executor cost, profit, margin, client debt.
5. Client payment: amount due, paid, invoice, paid date, edit action.
6. Translation works: service, language pair, volume, executor, deadlines, client/executor pricing, status and existing edit/duplicate/archive actions.
7. Documents: analyzed files with page/character data and upload action.
8. Activity/history: readable timeline using the existing activity API.
9. Link to source application when present.

### Backend rule
Prefer zero backend changes if current `OrderDetail`, payment, file and activity endpoints already provide the necessary data. Do not invent comments/tasks/chat APIs merely to imitate the reference. If a desired visual element has no data source, omit it or label it as future scope rather than fabricating data.

### Layout behavior
Desktop:
- deal header + stage pipeline + compact section nav
- structured overview/finance band
- operational split workspace with a compact side rail and a larger works/files area
- activity timeline should be easy to scan

Tablet/mobile:
- no horizontal document overflow
- pipeline may scroll horizontally as its own control
- order sections stack logically
- actions remain reachable and do not overlap
- long client names, filenames, language pairs and notes wrap/ellipsis according to importance

## ENGINEERING RULES
- Preserve current API contracts and business logic.
- No React state/prop mutation.
- Do not add effects unless an external side effect is genuinely required.
- Same semantic UI = same shared pattern.
- Do not create duplicate helpers/components.
- Avoid `!important`; fix cascade/import order/selector source instead.
- Use `min-width:0` and intentional text wrapping for grids/flex layouts.
- Preserve keyboard behavior and visible focus.
- Preserve reduced-motion behavior.

## REQUIRED VALIDATION
Run what the environment supports, in this order:
1. syntax/parser check
2. TypeScript typecheck
3. targeted E2E/theme tests
4. lint
5. production build
6. visual QA at 1440, 1024, 768, 430, 390, 375, 360 and 320 where feasible

Update existing E2E theme expectations to semantic theme values and add coverage for:
- order stage pipeline
- persistent dark theme across major routes
- auth dark mode
- no horizontal overflow
- dark order card core/works/payment/timeline surfaces

Never claim a check passed unless it actually ran. Clearly separate completed checks from checks blocked by missing dependencies/environment.

## DEFINITION OF DONE
The task is complete only when:
- the dark theme looks intentionally designed across every major route and shared control;
- there are no obvious light-theme leaks in dark mode;
- the order card reads like a mature operational deal workspace for Lingvo Connect;
- existing order calculations/actions and API contracts still work;
- responsive behavior is stable;
- code is coherent and reusable rather than a pile of page-specific overrides;
- the final report lists changed files, preserved behavior, validation performed and any genuinely unverified items.
