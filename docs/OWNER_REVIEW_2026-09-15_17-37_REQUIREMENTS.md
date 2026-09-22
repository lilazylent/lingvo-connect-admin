# Owner review 2026-09-15 17:37 — binding requirements

Sources:
- `references/OWNER_REVIEW_TRANSCRIPT_2026-09-15_17-37.pdf` — owner voice transcript;
- `references/OWNER_REVIEW_2026-09-15_17-37_contact_1.jpg`;
- `references/OWNER_REVIEW_2026-09-15_17-37_contact_2.jpg`;
- `references/OWNER_REVIEW_2026-09-15_17-37_contact_3.jpg` — visual contact sheets from the same recording.

This file supplements `CRM_MVP_MASTER_SPEC.md`. It separates remaining MVP frontend debt from the new post-MVP executor-matching feature. Do not move the matching workflow into Phase 06–09.

## A. Remaining MVP debt — must be closed before Phase 09 acceptance

### Applications / side detail panels
- Hide permanently visible decorative scrollbars in compact side-detail cards while preserving wheel/touch/keyboard scrolling.
- The full Application header must not scatter `Заявка`, service, current status, status editor and CTA across unrelated empty areas. Use one compact, readable hierarchy/grid.
- The burgundy accent rule must not protrude beyond rounded surfaces. Clip it inside geometry or fade it softly.

### Orders / order detail
- Keep the pipeline concept, but reduce the visual weight of the active stage number/circle and guarantee Dark contrast.
- Remove unnecessary local scrollbar chrome from the order workspace while keeping scrolling functional.
- `Работы`: align the work index (`01`), service title and actions; do not regress to tiny action/meta typography.
- `Финансы`: current large scattered tiles are not accepted. Use a compact hierarchy; move Profit up, place Executor cost logically nearby, reduce long tiles/dead space, keep the client estimate collapsible.
- `Файлы`: expose real Open/Preview and Download actions from the Order card when supported by backend.
- `История`: retain the concept and ensure global readable typography applies.
- New Order / calculation surfaces: remove dark-blue text on graphite, white legacy separators and clipped labels such as the conditional-page description.

### Dark priority
Dark surfaces reveal more defects and should be the stricter visual reference for contrast. Do not accept blue-on-graphite copy or accidental white strips/islands.

### Service dictionary consistency
The service used by an Order work and the service/capability assigned to an Executor must come from one canonical service dictionary. Separate free-text taxonomies are not acceptable.

## B. Phase 06 foundation

Phase 06 owns Files, Users, Settings and canonical data foundations only:
- canonical service dictionary reused by Orders and Executor capabilities;
- canonical language dictionary reused by tariffs/order work/executor pair selectors;
- executor capability stores service + language pair + default rate/rate unit;
- business keys are stable: existing service codes and language names are not silently renamed while operational records still persist those strings;
- Files provides real preview/download/source actions;
- Users action menus stay reachable inside the viewport and close on outside click/Escape;
- Settings uses one modular visual/editor pattern.

Phase 06 does **not** auto-select executors and does not create an availability calendar.

## C. Post-MVP Phase 10 — Executor matching + translation routing

### Candidate matching
For a concrete Order work, search real executor capabilities by:
- canonical service;
- language pair;
- later: persisted availability/calendar for the required period/deadline.

Executor language pairs are bidirectional by default under the current owner requirement. A stored `JP ↔ RU` pair matches both `JP → RU` and `RU → JP`; `RU ↔ EN` matches both directions.

If several executors fit, show all suitable candidates and let the manager choose. Do not silently choose the first candidate.

### Direct route first
If a direct foreign-to-foreign executor exists (for example `JP ↔ EN`), allow/offer the direct assignment.

### Routed translation through Russian
If no direct candidate is selected/available, a foreign-to-foreign work may route through Russian:
1. one executor completes the whole first stage, e.g. `JP → RU`;
2. another executor completes the whole second stage, e.g. `RU → EN`.

Example approved by owner:
- Дмитрий supports `JP ↔ RU`;
- Василий supports `RU ↔ EN`;
- `JP → EN` may route Дмитрий (`JP → RU`) + Василий (`RU → EN`).

The client still sees one work/order; routing is an internal production workflow.

### No candidate
If a stage has no suitable executor:
- show `Исполнитель не найден`;
- offer `Добавить исполнителя вручную`;
- never invent a candidate.

### One stage = one executor
Do not split one production stage between several executors. Each stage has its own actual volume because translated character/page counts may change after the intermediate translation.

### Rates and economics
- Auto-fill the executor default rate/rate unit from the selected capability when available.
- Allow the manager to override the assignment rate.
- Persist executor, rate, unit, actual volume, deadline, amount owed and status per stage/assignment.
- Feed the sum of assignment costs into Order executor cost / profit / margin.
- Client tariff calculation remains separate from internal executor costing.

### Availability calendar
A future persisted calendar must represent at least free intervals, busy/assigned periods and vacation/unavailable periods. Candidate UI should expose deadline compatibility; the manager still makes the final selection.
