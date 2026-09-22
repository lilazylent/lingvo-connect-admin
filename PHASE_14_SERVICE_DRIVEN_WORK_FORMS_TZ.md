# Phase 14 — Service-Driven Work Forms

Build: `phase14-service-driven-forms-20260921-r1`

## Goal
Replace the universal Order Work form with a service-driven form based on Oleg's service matrix and the confirmed tariff rules, while preserving the existing Order → OrderWork → ExecutorAssignment architecture.

## In scope
- Service is selected first; only fields applicable to that service are rendered and accepted.
- Canonical service metadata is server-owned and exposed to the admin UI.
- Persist service-specific quantities: documents, seconds, hours, start date/time, certification mode.
- Written/transcription conditional pages: 1800 characters with spaces = 1 page, upward rounding to one decimal, minimum billable quantity 1 page.
- Company certification modes:
  - `BOUND` / «Сшивка» → quantity by documents.
  - `PER_PAGE` / «Постранично» → quantity by pages.
- Audio listening → seconds; no unconfirmed 60-second minimum is hardcoded.
- Consecutive/simultaneous interpreting → hours plus language pair/topic/start/end date-time.
- Matching adapts by service:
  - `LANGUAGE_PAIR`
  - `SOURCE_LANGUAGE`
  - `SERVICE_ONLY`
- Routing through Russian remains limited to written translation.
- Executor assignment volume uses the same service-owned quantity shape; manual assignment rate remains assignment-specific.
- Existing non-billable work behavior remains unchanged.

## Explicitly out of scope
The following are deferred to the future landing/customer-account integration phase:
- client balance / wallet;
- deposits;
- automatic balance deductions;
- customer registration/login on the landing;
- personal customer accounts;
- landing ↔ CRM account/order synchronization.

## Canonical service matrix
| Service | Main fields | Billing unit | Matching |
| --- | --- | --- | --- |
| Written translation | source, target, chars, auto pages, topic, translator type | conditional page | language pair + routing |
| Editing | source, target, chars, pages, topic, translator type | conditional page | language pair |
| Proofreading | source, target, chars, pages, topic, translator type | conditional page | language pair |
| Typing | source, chars, pages, topic, translator type | conditional page | source language |
| Notarial certification | document count | document | service only |
| Lingvo Connect certification | mode + documents/pages | document/page | service only |
| Apostille | document count | document | service only |
| Notarial copy | page count | page | service only |
| Text layout | page count | page | service only |
| Drawing layout | page count | page | service only |
| Recognition | page count | page | service only |
| Delivery | start/end date-time | fixed | service only |
| Audio listening | duration seconds | second | service only |
| Transcription | chars + auto pages | conditional page | service only |
| Consecutive interpreting | source, target, hours, topic, start/end | hour | language pair |
| Simultaneous interpreting | source, target, hours, topic, start/end | hour | language pair |

## Acceptance criteria
1. A new Work initially asks only for a service.
2. Selecting a canonical service deterministically defines visible/persisted fields and the billing unit.
3. Hidden fields are cleared in the UI and rejected/sanitized by backend persistence.
4. Reopening an order restores all service-specific fields.
5. Pricing uses service-specific quantities and does not silently invent missing rates.
6. Executor matching no longer requires a language pair for service-only work.
7. Existing two-stage RU routing still works for written translation only.
8. `client_billable=false` still excludes work from client revenue/text while executor cost remains in finance.
9. No balance/deposit/customer-account logic is introduced.
