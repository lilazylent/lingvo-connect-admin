# Phase 12 Migration Hotfix Report

Build ID: `phase13-internal-works-20260919-r1`

## Problem

PostgreSQL rejected migration `0021_order_number_v2` before the real renumbering started:

`psycopg.errors.StringDataRightTruncation: value too long for type character varying(32)`

The migration temporarily wrote `MIG-<order UUID>` into `orders.number`. A UUID-based value is 40 characters including the `MIG-` prefix, while `orders.number` is `VARCHAR(32)`.

The failed Alembic upgrade caused the backend container health check to fail, which then prevented `docker compose up -d backend frontend` from completing normally.

## Fix

The temporary migration namespace now uses a deterministic ordinal:

`MIG-00000001`, `MIG-00000002`, ...

This value:
- is unique for every row processed by the migration;
- is at most 12 characters for the expected range and safely below 32 characters;
- exists only inside the migration transaction;
- is immediately replaced by the final `YY-0-NNNN` public number.

No schema change and no new Alembic revision were required. The failed `0021` migration had not completed, so correcting that unapplied migration is the minimal safe patch for the affected environment.

## Verification

- Migration smoke test with legacy `LC-O-*` numbers: PASS
- Result: `26-0-0001`, `26-0-0002`, `27-0-0001`: PASS
- Year counters rebuilt as `2026 -> 2`, `2027 -> 1`: PASS
- Python compile: PASS
- Alembic heads: exactly one, `0021_order_number_v2 (head)`
- Foundation audit: PASS
- CSS ownership: PASS
- Phase 08/09 audits: PASS
- Phase 10 availability/matching/routing/client-demo/route-stage/finance audits: PASS
- Phase 11 audit: PASS
- Phase 12 numbering audit: PASS
- Phase 12 assignment/calculator audit: PASS

## Runtime recovery

Because PostgreSQL transactional DDL/updates rolled the failed migration back, the user does not need to repair order numbers manually. Rebuild the backend from this hotfix and rerun `alembic upgrade head`.
