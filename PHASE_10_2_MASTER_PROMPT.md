# Phase 10.2 Master Execution Prompt — Direct Executor Matching

You are implementing Phase 10.2 of Lingvo Connect CRM from the accepted Phase 10.1 Team Calendar baseline.

## Mandatory engineering protocol

1. Re-read the latest code, Phase 10 specification, current models/API/tests and prior Phase 10.0/10.1 architecture before touching code.
2. Diagnose existing contracts first. Never create a parallel assignment subsystem.
3. Write the phase contract before implementation.
4. Make the smallest coherent patch.
5. Re-read every changed file after implementation.
6. Verify with real static/runtime checks that are available; never claim checks that did not run.
7. Preserve Phase 0-10.1 regression-frozen behavior.
8. Produce changed-files and implementation reports and a clean source archive.

## Objective

Implement a deterministic read-only direct executor matching backend for one existing `OrderWork`.

The matcher must use only persisted facts:

- canonical work service;
- requested source/target languages;
- non-archived executors;
- saved executor directions;
- saved default rate/unit;
- saved availability intervals;
- executor/work/order deadline data.

Language pairs are bidirectional. Direct foreign-to-foreign capability is valid.

## Availability rule

Do not invent a work start date. Resolve one required date with this precedence:

1. `OrderWork.executor_deadline`
2. `OrderWork.deadline`
3. `Order.deadline`

On that date:

- `FREE` => AVAILABLE / compatible true;
- `BUSY`, `UNAVAILABLE`, `VACATION` => UNAVAILABLE / compatible false;
- no covering interval => UNKNOWN / compatibility null;
- no required date => UNKNOWN / compatibility null.

`UNKNOWN` is never `FREE`.

## API contract

Add authenticated read-only endpoint:

`GET /api/admin/orders/{order_id}/works/{work_id}/executor-candidates`

Return a stable machine-readable structure with work inputs, missing fields, required date/source, real candidates, capability facts, default rate/unit, availability evidence and counts.

## Architectural preference

Keep matching logic outside the large router in a focused backend module. The router should validate order/work ownership, load service metadata, call the matcher and return the result.

No DB migration should be needed for Phase 10.2.

## Forbidden scope

Do not implement Phase 10.3+:

- no frontend candidate picker;
- no assignments;
- no routing via Russian;
- no route stage persistence;
- no finance mutation;
- no ranking/AI score;
- no brand/mobile owner patches.

## Tests

Cover at least:

- bidirectional RU↔EN;
- direct JP↔EN;
- wrong pair/service exclusion;
- archived executor exclusion;
- FREE/BUSY/VACATION/UNKNOWN classification;
- deadline precedence/fallback;
- missing input safe response;
- auth behavior.

Finish by documenting exact verification results and local PowerShell commands appropriate to the actually changed layers.
