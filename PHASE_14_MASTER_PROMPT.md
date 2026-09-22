# Phase 14 Master Prompt

Use the latest Phase 13.5 baseline as source of truth.

Implement a minimal coherent service-driven Order Work system from Oleg's confirmed service matrix. Keep the existing Order → OrderWork → ExecutorAssignment data model and tariff engine; do not create a parallel work/assignment subsystem.

Requirements:
- Make service selection the first decision in a Work form.
- Define one canonical server-side service schema: fields, billing unit, matching mode, routing support, and variants.
- Render only schema-owned fields in the admin frontend and sanitize stale/hidden fields on the backend.
- Persist document_count, duration_seconds, hour_count, start_date, start_time, certification_mode where applicable.
- Conditional page rule: 1800 chars with spaces = 1 page; round upward to 0.1; positive quantities below 1800 still bill as 1 page.
- Company certification: BOUND uses documents; PER_PAGE uses pages.
- Audio listening bills by seconds. Do not hardcode a one-minute minimum until confirmed by the tariff source.
- Interpreting uses hours and language pair/topic/start/end.
- Match executors by LANGUAGE_PAIR, SOURCE_LANGUAGE, or SERVICE_ONLY as required by the service definition. Only written translation can route via Russian.
- Preserve assignment-specific manual rates, availability semantics, finance separation, and internal/non-billable work behavior.
- Preserve existing visual/CSS ownership and responsive patterns. No new `!important`.
- Add an additive Alembic migration and regression coverage.

Out of scope for this phase: client wallet/balance, deposits, automatic deductions, landing registration, customer accounts, and landing↔CRM synchronization. Those belong to a later website/customer-account phase.
