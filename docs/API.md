# FINTEL API Surface

The current application intentionally exposes both REST and tRPC. REST is used for direct integration, refresh, health, and scheduled callbacks. tRPC provides typed frontend hydration and protected portfolio procedures.

## REST endpoints

| Method | Path | State |
| --- | --- | --- |
| GET | `/api/market/cbk` | Persisted CBK market observations with freshness |
| GET | `/api/market/fx` | Persisted CBK FX observations |
| GET | `/api/market/treasury-bills` | Persisted Treasury Bill observations |
| GET | `/api/market/bonds` | Persisted Treasury Bond observations |
| GET | `/api/yield-curve` | CBK observations passed to Python interpolation |
| POST | `/api/derivatives/price` | Python Black-Scholes, CRR, or Monte Carlo |
| POST | `/api/greeks` | Python derivative Greeks |
| POST | `/api/monte-carlo` | Python Monte Carlo pricing |
| POST | `/api/risk/var` | Permission-protected portfolio risk |
| POST | `/api/risk/stress` | Permission-protected stress scenarios |
| GET | `/api/portfolio` | Permission-protected owner-scoped portfolio risk |
| GET | `/api/historical-market-data` | Historical coverage |
| GET | `/api/historical/analytics` | Observed historical analytics |
| GET | `/api/models` | Model readiness and requirements |
| POST | `/api/market/refresh` | Permission-protected official CBK ingestion |
| POST | `/api/market/backfill` | Permission-protected bounded historical ingestion |
| GET | `/api/data/health` | Database-backed source health |
| GET | `/api/scheduler/status` | Schedule definitions and activation state |
| GET | `/api/system/status` | Service status |
| POST | `/api/scheduled/cbk-ingestion` | Cron-authenticated ingestion callback |

Missing data responses use `DATA REQUIRED`, stale rows use `STALE`/`DATA STALE`, and unavailable services use `BACKEND OFFLINE`. The API does not silently replace missing market data with sample values.

## tRPC groups

The application router includes `auth`, `market`, `cbk`, `fx`, `treasuryBills`, `bonds`, `yieldCurve`, `derivatives`, `greeks`, `monteCarlo`, `analytics`, `risk`, `portfolio`, `audit`, `research`, `data`, `settings`, `systemStatus`, and `models` groups. Portfolio creation and position writes require `portfolio.write`; owner-scoped reads require `portfolio.read`; risk queries require `risk.read`.

## Integration rule

Use the typed tRPC contracts for React hydration. Use REST for external services, scheduled callbacks, source health, and direct integration. Keep financial calculations in the existing Python engine.
