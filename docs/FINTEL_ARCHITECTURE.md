# FINTEL Architecture

This document describes the architecture that exists in the current repository. It does not describe a desired future architecture.

## System flow

```text
Official CBK web pages, CSV files, and auction-result PDFs
                         ↓
CBK fetchers and historical parsers
                         ↓
Validation, freshness classification, lineage, duplicate detection
                         ↓
MySQL/TiDB database through Drizzle ORM
                         ↓
Synchronous Python quant-engine process adapter
                         ↓
Express REST endpoints and tRPC procedures
                         ↓
React/Vite FINTEL terminal
                         ↓
FINTEL — Kenya Financial Intelligence
```

## Frontend

`client/src/App.tsx` provides the application shell, dark theme, error boundary, tooltips, and toast layer. `client/src/pages/Home.tsx` contains the command-centre terminal and responsive navigation. `client/src/components/fintel/DataDetails.tsx` presents source lineage. `client/src/components/fintel/PortfolioWorkspace.tsx` provides the current owner-scoped portfolio and position-entry workflow. The frontend uses tRPC from `client/src/lib/trpc.ts`; it does not contain independent mock market calculations.

The sidebar contains Overview, Market Intelligence, Yield Curve, Fixed Income, Derivatives, Risk Engine, Portfolio, Quant Models, Research, Data, and admin-only Settings. Several entries currently change the active terminal heading while remaining within the command-centre surface rather than routing to separate page files.

## Backend

`server/_core/index.ts` assembles the Express application, OAuth routes, financial REST routes, scheduled callback, tRPC gateway, and Vite/static fallthrough. `server/api.ts` owns REST contracts and security checks. `server/routers.ts` owns typed tRPC contracts. `server/_core/permissions.ts` defines server-side role permissions. `server/security.ts` provides request IDs, security headers, and endpoint-class rate limiting.

`server/ingestion/cbk.ts` fetches and validates current CBK data. `server/ingestion/phase2.ts` parses Treasury Bond PDFs and historical FX/Treasury Bill sources. `server/scheduler.ts` defines six-field UTC schedules and callback metadata. Scheduler activation remains deployment-gated.

## Database

`drizzle/schema.ts` contains users, data sources, ingestion runs, current market observations, Treasury Bills, Treasury Bonds, FX rates, historical prices, yield-curve observations, instruments, portfolios, portfolio positions, risk results, pricing results, model runs, system status, and audit logs. Additive migrations are stored in `drizzle/` and snapshots in `drizzle/meta/`.

Source rows retain observation timestamps, publication timestamps, retrieval timestamps, expected frequency, currency, source URL, raw values, ingestion status, quality, and validation-related metadata. The database is MySQL/TiDB; it is not SQLite.

## Quantitative engine

`server/quant_engine/client.ts` starts `server/quant_engine/engine.py` as a bounded process call. It validates the JSON output, applies time and output limits, and maps failures to explicit `BACKEND OFFLINE` or calculation-error states. The engine contains the existing fixed-income, derivative, yield-curve, portfolio-risk, and historical-analysis functions. A separate FastAPI service does not currently exist.

## External boundaries

The CBK source is public and officially published by the Central Bank of Kenya. FINTEL is independent and does not imply CBK endorsement. OAuth and Forge services use runtime environment variables. GitHub is not connected in this session. Production task registration is not performed against the sandbox.
