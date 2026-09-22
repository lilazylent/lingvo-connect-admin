# Post-MVP Phase 10 — Executor matching + translation routing

Status: Phase 10.0/10.1 accepted; Phase 10.2 direct matching implemented; Phase 10.3 manager-selection UI implemented; Phase 10.4 Russian fallback routing implemented for local acceptance  
Dependency: Phase 06 canonical services/languages/rates foundation + stable Orders/Executors data contracts

## Goal

Automate selection of suitable executors for an Order work using real saved executor capabilities, while keeping the manager in control of the final assignment.

## Inputs

Matching starts from a concrete Order work:

- canonical service;
- source language;
- target language;
- deadline / required period;
- work volume when available.

No fake candidate data is allowed.

## Language-pair semantics

An executor language pair is bidirectional by default under the current owner requirement:

- JP↔RU matches JP→RU and RU→JP;
- RU↔EN matches RU→EN and EN→RU.

A future explicit one-way capability may be added as a separate field/rule, but is not assumed in the current specification.

## Direct match

If one or more executors support:

- the required service;
- the requested language pair;
- the required period according to availability data;

the CRM shows the suitable candidate list. It does not silently pick the first candidate.

The manager chooses the executor.

If a direct foreign→foreign executor exists (for example JP↔EN), direct execution is allowed and should be offered rather than forcing a route through Russian.

## Routed match through Russian

When no direct candidate is selected/available for foreign→foreign, the CRM may construct the production route through Russian.

Example work: JP→EN.

Candidate route:

1. JP↔RU executor performs the complete JP→RU stage.
2. RU↔EN executor performs the complete RU→EN stage.

Example from owner specification:

- Дмитрий supports JP↔RU;
- Василий supports RU↔EN;
- JP→EN may therefore route Дмитрий (JP→RU) + Василий (RU→EN).

The client still sees one client work/order; routing is an internal production workflow.

## Multiple suitable executors

If several executors match a stage, show the candidate list and allow the manager to choose. Candidate presentation should eventually include availability/calendar context instead of ranking by an unexplained hidden score.

## Executor calendar / availability

Phase 10 includes a persisted executor availability calendar that can represent at minimum:

- free intervals;
- busy/assigned until a date/period;
- vacation/unavailable periods.

Matching must show whether a candidate can meet the required period/deadline. Availability informs the manager; candidate selection remains explicit.

## No candidate state

If a stage has no suitable executor:

- show `Исполнитель не найден`;
- provide a clear action `Добавить исполнителя вручную`;
- do not invent a candidate or silently create an invalid route.

## One stage = one executor

A production stage is not split between several executors.

- Stage JP→RU is completed in full by one executor.
- Stage RU→EN is completed in full by one executor.

Each stage stores its own actual volume. The logical document is the same, but translated character/page counts may change after the intermediate stage.

## Rates and cost

The executor default rate is auto-filled from the executor/capability data when available.

The manager may override the rate for the specific assignment.

Each stage/assignment stores its own:

- executor;
- rate;
- rate unit;
- actual volume;
- deadline;
- calculated amount owed;
- status.

The sum of executor assignment costs feeds the existing Order economics:

- executor cost;
- profit;
- margin.

Client tariff calculation and internal executor costing remain separate concepts.

## Candidate UI contract

The manager should be able to see why a candidate fits. A candidate can expose real data such as:

- executor name;
- service;
- matched language pair;
- availability state / busy-until / vacation;
- default rate;
- deadline compatibility.

Do not add ratings, capacity percentages or recommendation scores unless they become real backend data.

## Acceptance criteria

1. Direct candidate list is generated from real capability records.
2. Bidirectional pair matching works in both directions.
3. Direct foreign→foreign candidate is supported when present.
4. Fallback JP→RU→EN-style routing can create two sequential stages through Russian.
5. Multiple candidates are shown for manager selection, not silently auto-selected.
6. No-candidate state offers manual executor creation/assignment.
7. One stage is assigned to one executor only.
8. Default rate auto-fills but can be overridden per assignment.
9. Each stage can store a distinct actual translated volume.
10. Availability calendar affects candidate suitability.
11. Assignment costs feed Order financial summary.
12. All matching/routing remains post-MVP and is not pulled into Phase 06–09.


## Phase 06 foundation now available

Phase 06 deliberately stops before matching but provides the persisted inputs Phase 10 will consume:

- canonical `ServiceType` dictionary reused by Order works and Executor capabilities;
- canonical `language_catalog` reused by language selectors;
- executor capability rows with language pair + canonical service + default rate/rate unit;
- assignment-specific rates remain separate and therefore can override the executor default later;
- no availability/calendar schema is introduced yet, so Phase 10 may design that persistence around real scheduling requirements rather than a premature frontend mock.

The owner-approved matching rules in this document remain unchanged.


## Phase 10.0/10.1 implementation baseline

Phase 09 is accepted. Phase 10 starts with architecture freeze and persisted executor availability.
Matching, candidate selection and translation routing remain deferred to Phase 10.2+ until the availability foundation is locally accepted.

Canonical implementation contract: `../phases/PHASE_10_0_10_1_ARCHITECTURE_AVAILABILITY.md`.


## Phase 10.2 implementation baseline

Phase 10.2 adds a read-only direct matching service and API on top of the accepted availability foundation. It does not assign executors or build routed stages.

Canonical Phase 10.2 contract: `../phases/PHASE_10_2_DIRECT_MATCHING.md`.

Endpoint:

`GET /api/admin/orders/{order_id}/works/{work_id}/executor-candidates`

The endpoint returns real capability matches with bidirectional language-pair semantics, persisted default rate/unit data, and factual availability classification for the best persisted deadline date (`executor_deadline` -> work deadline -> order deadline). `UNKNOWN` availability is never treated as free.


## Phase 10.3 implementation baseline

Phase 10.3 exposes the factual Phase 10.2 candidate response inside the existing persisted OrderWork assignment editor. Candidate selection is explicit and draft-only: selecting an executor creates a normal `ExecutorAssignment` draft with the candidate default rate/unit and current work volume/deadline defaults; the manager may edit them, and persistence still occurs only through `Сохранить работу`.

`AVAILABLE` and `UNKNOWN` candidates remain manager-selectable, while candidates blocked on the matched required date remain visible but disabled with an explanatory state. Existing manual assignment and multi-executor compatibility remain intact.

Canonical Phase 10.3 contract: `../phases/PHASE_10_3_MATCHING_UI.md`.

## Phase 10.4 implementation baseline

Phase 10.4 extends the read-only matching response with a factual two-stage foreign→Russian→target route for foreign-to-foreign works. Direct candidates remain first and are never replaced. Each routed stage reuses the same capability, default-rate and availability semantics as direct matching.

The manager may inspect and locally select one candidate for each route stage in the existing matching panel. Phase 10.4 deliberately does not persist route stages or append routed choices to ordinary assignments because stage persistence, per-stage actual volume and cost belong to Phase 10.5.

Canonical Phase 10.4 contract: `../../PHASE_10_4_ROUTING_THROUGH_RUSSIAN_TZ.md`.
