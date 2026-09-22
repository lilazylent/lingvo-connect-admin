# Internal execution prompt — Phase 0

You are working on the current Lingvo Connect Admin source, not a remembered version.

PRE-FLIGHT:
1. Read current `AGENTS.md`, `CRM_MVP_MASTER_SPEC.md`, current layout imports, all global CSS token roots, shared UI primitives, theme loader and package scripts.
2. Inventory routes and backend boundaries. Do not modify business contracts.
3. Measure CSS cascade debt before editing.

OBJECTIVE:
Create a canonical frontend foundation without redesigning feature pages. One file must own semantic Light/Dark, geometry, typography, spacing, elevation, motion and z-index values. Preserve legacy aliases so the current UI does not require an unsafe all-at-once rewrite.

CONSTRAINTS:
- No page redesign.
- No backend/API/database change.
- No fake data.
- No new `!important`.
- No destructive deletion of legacy CSS.
- Make the migration path explicit and measurable.

VERIFY:
- canonical token file imported last;
- required semantic tokens present;
- TypeScript parses;
- CSS parses;
- foundation audit passes;
- report checks that could not run;
- local Docker runtime remains the final acceptance gate.
