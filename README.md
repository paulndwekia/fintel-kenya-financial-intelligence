# FINTEL — Kenya Financial Intelligence

FINTEL is the frontend evolution of the Kenya Financial Intelligence platform. It combines official Central Bank of Kenya observations, an existing Drizzle/MySQL data layer, the existing Python quantitative engine, Express REST endpoints, tRPC procedures, and a React institutional terminal.

## Architecture

```text
Official CBK pages and documents
        ↓
CBK ingestion, validation, deduplication, and lineage
        ↓
MySQL/TiDB via Drizzle
        ↓
Existing Python quantitative engine
        ↓
Express REST + tRPC
        ↓
React FINTEL terminal
```

The Python engine remains the source of financial calculations. The frontend does not generate market values and does not present sample inputs as live observations.

## Preserved capabilities

The project preserves CBK market data, FX, Treasury Bills, Treasury Bonds, yield-curve construction, bond pricing, YTM, duration, modified duration, convexity, DV01, Black-Scholes-Merton, CRR Binomial, Monte Carlo, Greeks, volatility analytics, parametric VaR, expected shortfall, drawdown, stress testing, portfolio analytics, and observed-history backtesting.

## Data-status contract

Every data-dependent surface uses explicit state labels. `CURRENT` and `LIVE` mean that a validated source or calculation is available. `STALE` means the last validated observation is outside the source cadence threshold. `DATA REQUIRED` means a required observation, portfolio, credential, or connector is missing. `BACKEND OFFLINE` means the database or quantitative engine cannot be reached. `DEMO / SAMPLE` is reserved for analyst examples whose inputs are not live market observations.

## Project structure

```text
client/src/           React terminal, reusable UI, FINTEL data lineage disclosure
server/_core/         OAuth, tRPC, permissions, security, server lifecycle
server/ingestion/     CBK current, bond PDF, FX history, and Treasury Bill parsers
server/quant_engine/  Existing Python models and Node process adapter
server/db.ts          Drizzle persistence, lineage, portfolio, risk, and audit helpers
server/api.ts         Financial REST contracts
server/scheduler.ts   Cron-only CBK callback and source schedule definitions
drizzle/              Schema and additive migrations
docs/                 Technical audits and production-foundation notes
scripts/              Live source probes and smoke scripts
```

## Local verification

```bash
pnpm test
pnpm check
pnpm build
```

The current verification suite covers CBK parsers, Treasury Bond parsing, REST contracts, tRPC procedures, scheduler contracts, observed-history risk boundaries, role authorization, and rate-limit/security headers.

## Security foundation

Portfolio writes, risk execution, manual ingestion, and audit-log access are protected by server-side role permissions. Portfolio reads are owner-scoped. Request IDs and secure response headers are added centrally. Endpoint-class rate limiting protects ingestion, pricing, risk, scheduled callbacks, and OAuth routes. Audit events are persisted for portfolio operations and authorization denials.

The current rate limiter is process-local because the managed preview runs as one process. A horizontally scaled deployment should move buckets to a shared store. MFA and email-verification policy remain deployment decisions.

## Scheduler handoff

The callback is available at `/api/scheduled/cbk-ingestion` and authenticates cron callers through the existing SDK. Source definitions retain cadence, task UID, next scheduled time, inserted/duplicate/rejected counts, duration, and errors. Four production Heartbeat jobs are defined for current market data, Treasury Bills, Treasury Bonds, and historical backfill.

The site must be deployed before those jobs are created or enabled. No production scheduler task is created against the sandbox preview. After deployment, create the four project-level jobs, persist their task UIDs into `data_sources.scheduleCronTaskUid`, enable the scheduler flag, and verify callback logs.

## Data sources

Current data is sourced from official public CBK pages and documents. FINTEL is an independent platform and does not imply CBK endorsement. CRM integration is not connected in this milestone and remains explicitly `CRM DATA REQUIRED`.

## Documentation

- [Master technical audit](docs/fintel-master-evolution-audit.md)
- [Production foundation implementation note](docs/fintel-production-foundation.md)
- [Phase 2 source notes](docs/phase2-sources.md)

## Preservation handoff

The portable handoff is documented in [the project manifest](FINTEL_PROJECT_MANIFEST.md), [the actual architecture](docs/FINTEL_ARCHITECTURE.md), [the API surface](docs/API.md), [data lineage](docs/DATA_LINEAGE.md), [quantitative models](docs/QUANT_MODELS.md), [security posture](docs/SECURITY.md), [current data status](docs/CURRENT_DATA_STATUS.md), [current feature inventory](docs/CURRENT_FEATURES.md), [the next-development roadmap](docs/NEXT_DEVELOPMENT_PHASE.md), and [database backup status](docs/DATABASE_BACKUP_STATUS.md). Safe environment variable names are listed in `docs/ENVIRONMENT.example`; it contains placeholders only because protected secret files are not exported.
