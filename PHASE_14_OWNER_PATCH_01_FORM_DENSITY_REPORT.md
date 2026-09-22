# Phase 14 Owner Patch 01 — Dynamic Form Density

Build: `phase14-service-form-density-fix-20260921-r2`
Baseline: Phase 14 Service-Driven Forms v1
Scope: frontend-only layout owner patch; no API, DB, migrations, pricing, matching, or service-schema changes.

## Owner feedback
Some service schemas produced an odd number of half-width controls before the full-width internal-work row. In those cases CSS grid left a dead half-column (for example notarial certification: discount occupied the left half while the right half stayed empty). Other services happened to have an even field count and looked compact.

## Root cause
Phase 14 correctly reset legacy nth-child spans and made every dynamic field `span 6` in the 12-column wizard grid. However, dynamic schemas have different field counts. When the final visible half-width control had no pair, the grid intentionally preserved an empty six-column cell.

## Fix
- Added dense row packing to the shared `.service-driven-grid` owner.
- Added one schema-independent orphan rule: when the final half-width control before `.internal-work-switch` is an odd child, it expands to the full row instead of leaving a dead half-column.
- The rule responds automatically when urgency/manual-discount controls are shown or hidden.
- Kept full-width intro, internal-work switch, and comment patterns unchanged.
- No service-specific selectors or screenshot-specific hacks were added.

## Coverage
Static parity audit covered every Phase 14 service and both company-certification variants, including urgency/manual-discount toggle states:
- written translation
- editing
- proofreading
- typing
- notarial certification
- company certification: bound / per-page
- apostille
- notarial copy
- text layout
- drawing layout
- recognition
- delivery
- audio listening
- transcription
- consecutive interpreting
- simultaneous interpreting

Result: no service/toggle state leaves a dead half-column immediately before the full-width internal-work row.

## Verification
- frontend foundation audit: PASS
- CSS ownership audit: PASS
- Phase 8–14 regression audits: PASS
- Phase 14 service-driven audit: PASS with density assertions
- contrast failures below 4.5: 0
- `!important`: 30 (unchanged baseline)

Full Next.js production build was not claimed because the source archive does not contain `node_modules` in this environment.
