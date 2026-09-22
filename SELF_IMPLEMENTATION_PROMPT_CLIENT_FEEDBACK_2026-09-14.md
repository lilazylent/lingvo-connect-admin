# Internal implementation prompt — Lingvo Connect Admin client feedback pass

## Role
Act as the senior full-stack engineer responsible for Lingvo Connect Admin. Work on the actual current project, not on remembered snippets. Preserve data, existing workflows and compatibility unless a requested business change requires otherwise.

## Mandatory workflow
PRE-FLIGHT -> inspect current frontend/API/models/migrations/tests -> diagnose existing behavior -> plan minimal coherent changes -> implement -> re-read every touched area -> run targeted checks -> report only verified results.

Do not create a new visual redesign in this pass. The user rejected the latest visual reference and wants the current CRM corrected first.

## Source of truth
Current baseline: `Lingvo_Connect_Admin_Video_Fixes_Zoom_RoleBadge_v2_1.zip`.
Consolidated requirements: `CLIENT_FEEDBACK_TZ_2026-09-14.md`.

## Required implementation

### A. Keep and verify user-side frontend fixes
- Role badges (`ADMIN`, `MANAGER`, future roles) have no white/inset highlight in either theme.
- At effective narrow viewports caused by 175–250% browser zoom, collapse the fixed sidebar early, preserve usable content width, contain table scrolling locally, and avoid document-level horizontal overflow.

### B. Dark theme correction only, not redesign
- Move dark theme from near-black to calm neutral graphite.
- Keep semantic surface hierarchy: canvas -> shell -> surface -> raised -> hover.
- Keep text/control/status contrast accessible and consistent across auth, tables, forms, dropdowns, dialogs, CRM cards, settings and files.
- Update theme preview/boot background so they represent the same palette.

### C. Per-work urgency multiplier
- Persist multiplier on each work.
- Preserve urgent boolean.
- Default old behavior to 1.5.
- UI presets: 1.2 / 1.5 / 2 / 3 / 4 and custom 1..10.
- Automatic pricing and selected tariff calculations must use the selected multiplier.

### D. Discount model
- Do not create new hard-coded thresholds from the latest voice message.
- Automatic discounts remain driven by configurable `PricingRule` rows already present in the project.
- Add per-work manual discount percentage override.
- Persist applied percentage and whether it was overridden.
- Manual tariff selection must retain a correct before-discount base so manual discount preview is accurate.

### E. Conditional pages
- For `CONDITIONAL_PAGE`, 1800 characters = one page, minimum one, existing precision internally.
- Character entry must update page count on frontend.
- Backend must also derive/store page count so API callers cannot create inconsistent records.
- Client-facing display rounds page count to one decimal.

### F. Client work vs executor work
- Never overload client volume with executor volume.
- Add `ExecutorAssignment` under a work: 0..N assignments, each with executor, own characters/pages/unit/rate/cost/manual-cost flag/deadline/time/status/notes.
- Safely backfill old single-executor rows in migration.
- Preserve old fields as compatibility mirrors.
- Finance and executor statistics/search use assignments so a split work does not distort revenue or executor cost.

### G. Client-facing preliminary summary
- Generate a copyable summary from persisted order/work data.
- Include service, language direction, client volume, tariff, urgency coefficient, discount, preliminary price and preliminary deadline.
- Include preliminary order total and disclaimer.
- Never expose executor identity/rate/cost, internal comments, profit/margin or internal notes.

## Explicitly deferred
- New frontend design/reference and global rebuild.
- Client self-service portal / client permissions.
- Client-specific permanent discounts until business rules are confirmed.

## Verification
At minimum:
- Python syntax check for modified backend/migration files.
- Alembic has exactly the expected new head.
- CRM + operations targeted tests including a work split across two executors.
- TSX parser check; if dependencies are unavailable, say full typecheck/build was not run.
- CSS parse check and contrast sanity for the new dark semantic palette.

Never claim a check passed if it was not actually executed.
