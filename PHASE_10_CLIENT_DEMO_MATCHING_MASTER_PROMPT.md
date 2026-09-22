# MASTER PROMPT — Lingvo Connect Priority Client Demo Matching

Work from the latest accepted repository only. Do not rebuild architecture from memory.

## Engineering protocol
Use exactly:
`PRE-FLIGHT → DIAGNOSIS → PLAN → MINIMAL COHERENT PATCH → RE-READ → VERIFY → REPORT → NEW BASELINE`.

Before editing, inspect current models, migrations, APIs, executor availability, executor directions, order wizard, work editor, assignment persistence and Phase 10.2–10.4 matching code.

## Objective
Make the agreed executor-matching feature demonstrable in **Step 05 «Исполнители»** of the new-order wizard.

### Domain rules
- Executor language pairs are unordered/bidirectional. `Русский + Японский` means both RU→JA and JA→RU.
- Matching must live in one backend/domain service; frontend only requests and renders results.
- Use the existing availability calendar. Never create a second availability system.
- A confirmed FREE direct executor has priority.
- If no FREE direct executor exists and both endpoints are foreign, attempt exactly `A → Русский → B`.
- Do not build arbitrary multi-hop graphs.
- Do not auto-persist any assignment without manager confirmation.
- Never invent rates, specialization, workload, ratings, recommendation scores or percentages.
- Preserve manual assignment.

### Deterministic ordering
Sort factual candidates by:
1. availability state (AVAILABLE before UNKNOWN before UNAVAILABLE);
2. known positive default rate ascending when available;
3. normalized executor name;
4. executor id.

### New-order Step 05
When Step 05 opens, automatically preview-match every work that has sufficient fields.
Use the same backend matcher as saved works.
Show direct candidates first.
If no confirmed available direct candidate exists and the Russian route is valid, show the two-stage route and preselect the first AVAILABLE candidate in each stage as the proposal.
Persist only after explicit manager action.

### Minimal persistence change
Do not add a new route subsystem. Extend `ExecutorAssignment` only enough to preserve stage meaning:
- route stage index;
- route source language;
- route target language.

Validate a composite save against current backend matching and calendar data.

### UI defect
Fix the shared numbered square badge (`01`, `02`, `03`) in its canonical owner so numerals are optically centered both horizontally and vertically. No page-specific margin hack.

## Verification
Run:
- Python compile;
- targeted and regression backend tests;
- Alembic heads;
- foundation/CSS ownership/Phase 8/9/10 audits;
- TypeScript syntax diagnostics;
- production build when dependencies are available.

Never claim a check passed if it did not actually run. If build cannot run because dependencies are unavailable, record the exact blocker.

## Deliverables
- updated project ZIP;
- TZ;
- this master prompt;
- implementation report;
- changed-files list;
- exact PowerShell commands for this version.
