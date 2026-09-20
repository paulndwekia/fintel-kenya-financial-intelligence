# FINTEL Project Manifest

## Project identity

**Project:** FINTEL — Kenya Financial Intelligence  
**Current date:** 20 September 2026  
**Current checkpoint:** `32df1dea` preservation checkpoint  
**Repository state:** Clean local working tree at the start of this handoff; existing `origin` points to the managed project artifact repository. GitHub backup is **NOT COMPLETED** because the GitHub connector is disabled.

## Technology

The frontend is React 19 with TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion, shadcn-style UI components, and tRPC hydration. The backend is Express with REST endpoints and tRPC procedures. Authentication uses the existing Manus OAuth/session integration. Authorization uses server-side role permissions for `admin`, `analyst`, `client`, `viewer`, and legacy `user` roles.

The data layer is Drizzle ORM over MySQL/TiDB. The quantitative engine is Python 3 with NumPy and SciPy, invoked through the existing synchronous process adapter at `server/quant_engine/client.ts`. CBK ingestion is implemented in `server/ingestion/cbk.ts`; Treasury Bond and historical parsers are in `server/ingestion/phase2.ts`.

## Current system

Official CBK current data is persisted for FX/key rates, Treasury Bills, Treasury Bond auction results, and yield-curve observations. Historical infrastructure persists observed FX and Treasury Bill series with source lineage and deduplication. The portfolio system supports owner-scoped portfolios and positions, but risk output remains `DATA REQUIRED` until an authorised user persists positions and the required aligned history exists.

The risk system preserves parametric VaR, expected shortfall, DV01, duration, stress scenarios, observed-history VaR/ES, drawdown, and backtesting. The model registry exposes yield curve, bond, Black-Scholes-Merton, CRR, Monte Carlo, and risk model states. CRM data and event/news feeds are not connected and remain explicitly `DATA REQUIRED`.

## API architecture

REST routes live in `server/api.ts`. tRPC contracts live in `server/routers.ts`. The frontend uses tRPC for hydration and the REST refresh endpoint for manual CBK ingestion. The scheduled callback is `POST /api/scheduled/cbk-ingestion`; its production task registration is deployment-gated.

## Deployment architecture

The current project runs as a managed WebDev application with a Vite development server and an Express production bundle. Deployment is required before Heartbeat jobs can reach the callback. No public deployment or domain change was performed during this preservation task.

## Testing status

At the preceding verified checkpoint, 24 Vitest tests passed across REST, tRPC, ingestion, scheduler, security, and Python risk regression suites. TypeScript and the production Vite/Express build passed. Re-run `pnpm test`, `pnpm check`, and `pnpm build` after restoring the package.

## Environment variables

Required names and safe placeholders are provided in `.env.example`. Real OAuth, database, Forge, and owner values must be supplied outside the repository. The archive contains no live secret values.

## Local operation

```bash
pnpm install
cp .env.example .env.local
# edit .env.local with local or managed development values
pnpm check
pnpm test
pnpm build
pnpm dev
```

The database schema is generated with the existing Drizzle configuration. Do not run migrations against production without a reviewed migration plan and backup. The current schema-only backup is described in `docs/DATABASE_BACKUP_STATUS.md`.

## Deployment handoff

Deploy the application first. Then register the four project-level Heartbeat tasks for `/api/scheduled/cbk-ingestion`, persist returned task UIDs in `data_sources.scheduleCronTaskUid`, enable the scheduler flag, and verify callback logs. Do not register jobs against the sandbox preview.

## Current limitations

The Python engine is a synchronous process bridge rather than a separately deployed FastAPI service. Rate-limit buckets are process-local. MFA and email-verification policy are deployment decisions. CRM, research/news, macro, cross-market correlation, historical curve replay, and report export are not fully connected. The derivative card uses clearly labelled sample inputs; its output is calculated by Python but is not live market data.

## Database backup status

A verified schema-only TiDB export is included at `backups/fintel-schema-2026-09-20.sql`. Database data backup is **NOT COMPLETED**; no database rows or private user information are included in the portable package.

## Portable archive

**Filename:** `FINTEL-Kenya-Financial-Intelligence-checkpoint-2026-09-20.zip`  
The final SHA-256 is recorded in the delivery report after the archive is built from this manifest.
