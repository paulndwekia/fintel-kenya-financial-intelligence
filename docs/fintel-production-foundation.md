# FINTEL Production Foundation — Implementation Note

## Scope

This milestone extends the existing FINTEL Kenya Financial Intelligence platform without replacing its approved dashboard, CBK ingestion, database, or Python quantitative models. It establishes the minimum production foundation for portfolio ownership, observed-history risk, authorization, auditability, rate limiting, scheduler observability, and operational handoff.

## Implemented

The database now includes an instrument master, portfolio ownership and lifecycle fields, position metadata, risk-result lineage, audit logs, and ingestion counters. Existing financial tables remain intact and the migration is additive. User roles now support `admin`, `analyst`, `client`, `viewer`, and the legacy `user` value.

Portfolio tRPC procedures now include authenticated portfolio listing, analyst/admin portfolio creation, position persistence, owner-scoped portfolio reads, observed historical-series resolution, and audit events. Portfolio risk calculations pass instrument-specific validated historical observations into the existing Python engine. If one or more instruments lack sufficient aligned observations, the engine reports `DATA REQUIRED` and names the missing instruments; it does not fabricate a portfolio history. When aligned observed series exist, historical VaR, expected shortfall, and drawdown are calculated from observed portfolio returns and the result is persisted with its data lineage.

Backend authorization is enforced through centralized permission procedures and REST checks. Sensitive operations such as portfolio writes, risk execution, manual CBK refresh, and historical backfill are no longer unauthenticated controls. The existing market and model read surfaces remain available for the terminal’s explicit data-state presentation. Role permissions are server-enforced; the dashboard now hides settings for non-admin users, hides portfolio navigation for roles without portfolio access, shows the active role, and prevents unauthorized manual refresh attempts.

The Express layer now adds request IDs, secure response headers, endpoint-class rate limits, and bounded retry responses. Audit events are written for portfolio actions and authorization denials. These controls are intentionally in-memory for the current managed runtime; a distributed production deployment should move rate-limit buckets to a shared store.

Scheduler definitions remain six-field UTC Heartbeat contracts using `/api/scheduled/cbk-ingestion`. The server initializes durable CBK source definitions with cadence, next-run metadata, task UID fields, and an explicit activation flag. The callback remains cron-only and resolves the source by the authenticated task UID. Actual task activation remains deployment-gated because the scheduling platform cannot reliably call a sandbox preview.

## Verification

The complete Vitest suite passes with 20 tests across REST integration, tRPC, CBK parsers, Phase 2 parsers, scheduler contracts, and Python historical-risk regression coverage. TypeScript validation passes. The production Vite and Express build passes. The existing Python quant engine remains the source of calculations for bond analytics, yield curves, Black-Scholes, CRR, Monte Carlo, Greeks, portfolio risk, stress scenarios, and observed-history analytics.

## Explicit remaining deployment actions

The site must be deployed before production Heartbeat tasks are created or enabled. After deployment, create four project-level Heartbeat jobs pointing at `/api/scheduled/cbk-ingestion`, persist each returned task UID into the corresponding `data_sources.scheduleCronTaskUid`, enable `CBK_SCHEDULER_ENABLED`, and verify callback logs. No scheduled job has been created from the sandbox because the official scheduler contract requires the production callback URL first.

The application still needs MFA/email-verification policy decisions, a shared rate-limit store if horizontally scaled, centralized metrics and alerting, backup/restore runbooks, and a separately managed FastAPI quant service only if synchronous Python process latency becomes a material operational constraint. CRM connectivity remains explicitly `DATA REQUIRED`; no CRM values are presented as live.
