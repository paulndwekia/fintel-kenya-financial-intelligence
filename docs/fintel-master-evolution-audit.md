# FINTEL — Kenya Financial Intelligence
## Master Evolution Technical Audit

**Audit scope.** This document records the current implementation after the incremental trust and risk-boundary fixes. The application was inspected before modification. Existing financial tables, CBK ingestion, API contracts, Python models, frontend navigation, tests, and deployment configuration were preserved.

## Executive assessment

FINTEL is a working React, Express, tRPC, Drizzle, MySQL/TiDB, and Python quantitative platform. It is already connected to official Central Bank of Kenya pages for current FX, key rates, Treasury Bills, Treasury Bond result documents, and historical backfills. The database stores observations with source lineage, observation timestamps, retrieval timestamps, validation status, quality, duplicate keys, and ingestion status.

The current implementation is production-oriented but not yet a complete institutional terminal. Portfolio positions are not populated by default, so portfolio VaR, DV01, duration risk, stress results, and historical drawdown remain explicitly unavailable until an authorized analyst or administrator persists them. The scheduled ingestion callback is implemented and source definitions are initialized, but production task activation remains deployment-gated. The Python engine remains invoked synchronously as a process bridge rather than as a separately deployed FastAPI service.

The most important trust issue found during this audit was a seeded random distribution inside the portfolio-risk function. That branch was removed. Historical VaR, historical expected shortfall, and drawdown now require actual observed prices and return **DATA REQUIRED** when those observations are absent. The existing parametric position-based analytics and deterministic stress scenarios remain available when a persisted portfolio is supplied.

## 1. Current frontend structure

The frontend is a React 19 application rendered through Vite. `client/src/App.tsx` provides the dark theme, error boundary, tooltip provider, toast layer, and the main FINTEL page. The primary dashboard is implemented in `client/src/pages/Home.tsx`.

The current interface uses a persistent responsive sidebar with the following workspace entries: Overview, Market Intelligence, Yield Curve, Fixed Income, Derivatives, Risk Engine, Portfolio, Quant Models, Research, Data, and Settings. These controls currently switch the active dashboard heading and preserve the command-centre layout; several entries are structural workspaces rather than fully separated page routes.

The visual system is an institutional dark terminal theme with Kenyan green accents, compact data cards, responsive grids, Recharts visualizations, and Framer Motion disclosure transitions. The existing `DataDetails` component exposes source, status, observation date, retrieval date, and frequency. It does not fabricate a value when lineage is missing.

The current frontend is connected to tRPC for market snapshots, yield curves, risk, model registry, system status, data health, historical analytics, and derivative pricing. The refresh control calls the existing REST refresh endpoint and invalidates the relevant tRPC queries. Loading states were strengthened for the command-centre status and yield-curve panel so initial query latency is not presented as missing data.

The derivative card is intentionally marked **DEMO / SAMPLE INPUTS**. Its inputs are hardcoded analyst examples, but its calculation result comes from the Python engine. They must not be interpreted as current USD/KES market observations.

## 2. Current backend structure

The Express server is registered in `server/_core/index.ts`. It provides OAuth routes, storage proxy support, CORS handling, the financial REST API, the scheduled CBK callback, tRPC, and Vite or static serving depending on runtime mode.

The REST layer is implemented in `server/api.ts`. It provides current market endpoints, derivative and Greek pricing, Monte Carlo pricing, portfolio risk and stress endpoints, historical analytics, model registry, current refresh, bounded backfill, data health, scheduler status, and system status.

The tRPC layer is implemented in `server/routers.ts`. It mirrors the main market, bond, yield-curve, derivatives, risk, portfolio, research, data, settings, system-status, and model-registry capabilities. Market reads use persisted database rows. Pricing and curve interpolation use the existing Python engine adapter.

The Python bridge is implemented in `server/quant_engine/client.ts`. It invokes `server/quant_engine/engine.py` with JSON input, enforces a timeout and output limit, reports backend-offline states, rejects invalid JSON, and propagates calculation errors as explicit API errors.

A separate FastAPI service does not yet exist. The current architecture uses a synchronous process boundary, which is suitable for the current development and managed-runtime scale but should eventually be migrated incrementally to a separately managed financial-services process if calculation volume or latency requires it.

## 3. Existing financial models detected

The existing Python engine includes the following working model families:

| Capability | Current implementation | Data boundary |
| --- | --- | --- |
| Bond pricing | Present-value pricing for coupon and principal cash flows | Analyst inputs or persisted terms when wired |
| YTM analytics | Used as a bond-analytics input and Treasury Bond observation field | Requires validated bond terms for production use |
| Macaulay duration | Implemented | Analyst or persisted bond inputs |
| Modified duration | Implemented | Analyst or persisted bond inputs |
| Convexity | Implemented | Analyst or persisted bond inputs |
| DV01 | Implemented for bonds and portfolio positions | Portfolio requires persisted positions |
| Nelson-Siegel/interpolated curve | Existing engine exposes target tenors and interpolation | Current CBK bill/bond observations |
| Black-Scholes-Merton | Implemented with price and analytical Greeks | Current UI uses clearly labelled sample inputs |
| CRR Binomial | Implemented with bumped Delta, Gamma, and Vega | Analyst inputs |
| Monte Carlo option pricing | Implemented with reproducible simulation and convergence path | Pricing simulation, not historical market data |
| Parametric VaR | Implemented from persisted portfolio positions and supplied volatilities | Requires portfolio positions |
| Expected Shortfall proxy | Implemented in the parametric risk calculation | Requires portfolio positions |
| Historical VaR and ES | Implemented in `historical_analytics` from observed prices | Requires actual historical observations |
| Drawdown | Implemented in observed historical analytics | Requires actual historical observations |
| Stress testing | Implemented for CBK tightening, FX, spread, liquidity, and rally scenarios | Requires portfolio positions |
| Backtesting | Historical analytics returns exceedance counts and rolling statistics | Requires actual historical observations |

The portfolio-risk function no longer generates a seeded synthetic 500-day history. Without observed prices, it returns `historical_status: DATA REQUIRED`, null historical VaR, null historical expected shortfall, and null drawdown. The new regression tests cover both the unavailable path and the observed-history path.

## 4. Existing database

FINTEL uses one Drizzle schema and one MySQL/TiDB database. No second financial database was created. The schema includes users, data sources, ingestion runs, market data, Treasury Bills, Treasury Bonds, FX rates, historical prices, yield-curve observations, portfolios, portfolio positions, risk results, pricing results, model runs, and system status.

The database supports additive lineage fields on market observations, including observation date, publication timestamp, retrieval timestamp, frequency, currency, source URL, ingestion status, raw value, and quality. Treasury Bond records additionally retain security code, ISIN, issue and maturity dates, tenor, coupon, price, yields, auction amounts, document URL, duplicate key, validation status, and review reason.

Historical rows are deduplicated by instrument and observation date. Current refreshes do not overwrite the historical observation series. Source records retain record counts, rejected counts, latest observation, last attempted update, last successful update, expected frequency, error status, schedule metadata, and quality.

## 5. Data sources and ingestion

The main authoritative source is the public Central Bank of Kenya website. Current ingestion uses the official CBK forex page and Treasury Bill page. Treasury Bond ingestion discovers linked official auction-result PDFs, downloads them with bounded retries, extracts text with `pdf-parse`, validates extracted fields, and quarantines records that fail validation.

Historical FX ingestion uses the official CBK historical CSV. The parser accepts the mixed date conventions observed in that file and preserves the raw source row. Historical Treasury Bill ingestion parses the official CBK average-rate table and retains source lineage.

The ingestion workflow follows the intended sequence: fetch, parse, validate, detect duplicates, persist, update source health, and expose the result through REST and tRPC. Unavailable optional sources are not allowed to downgrade an already validated source state.

The system does not imply a partnership or endorsement by CBK. FINTEL is an independent platform using public or authorized data sources.

## 6. Existing API endpoints

The current REST API includes the following contracts:

| Endpoint | Purpose | Current state |
| --- | --- | --- |
| `GET /api/market/cbk` | Current key rates and market observations | Database-backed with freshness state |
| `GET /api/market/fx` | Current FX observations | Database-backed with freshness state |
| `GET /api/market/treasury-bills` | Current Treasury Bill observations | Database-backed with freshness state |
| `GET /api/market/bonds` | Persisted Treasury Bond observations | Database-backed with source documents |
| `GET /api/yield-curve` | Curve interpolation from persisted points | Python-engine backed |
| `POST /api/derivatives/price` | Black-Scholes, CRR, or Monte Carlo pricing | Python-engine backed |
| `POST /api/greeks` | Derivative Greeks | Python-engine backed |
| `POST /api/monte-carlo` | Monte Carlo pricing | Python-engine backed |
| `POST /api/risk/var` | Portfolio risk calculation | Requires positions; historical fields require observed prices |
| `POST /api/risk/stress` | Portfolio stress scenarios | Requires positions |
| `GET /api/portfolio` | Latest persisted portfolio and risk output | DATA REQUIRED until a portfolio exists |
| `GET /api/historical-market-data` | Historical coverage summary | Database-backed |
| `GET /api/historical/analytics` | Observed-only historical analytics | Database-backed and Python-engine backed |
| `GET /api/models` | Model registry and data requirements | Explicit readiness states |
| `POST /api/market/refresh` | Current CBK refresh | Real official-source ingestion |
| `POST /api/market/backfill` | Bounded FX, T-Bill, or Bond backfill | Real official-source ingestion |
| `GET /api/data/health` | Source health and lineage summary | Database-backed |
| `GET /api/scheduler/status` | Schedule definitions and activation state | Deployment-gated |
| `GET /api/system/status` | API, database, quant, market, and CRM status | Explicit CRM DATA REQUIRED |
| `POST /api/scheduled/cbk-ingestion` | Cron-only ingestion callback | Implemented; requires registered production task |

The frontend uses tRPC for read hydration and uses the REST refresh endpoint for the explicit refresh workflow. This dual surface is intentional during the incremental architecture phase.

## 7. Connected versus incomplete functionality

The following areas are connected to real data or live services: official CBK current FX and key rates; current Treasury Bills; Treasury Bond result PDFs; historical FX backfill; historical Treasury Bill backfill; persisted yield-curve observations; database lineage; source-health reporting; Python curve and derivative calculations; the existing OAuth flow; and the responsive FINTEL dashboard.

The following areas are partial or data-gated: initial portfolio population; portfolio VaR and DV01 display until authorized positions exist; portfolio duration; portfolio stress testing; historical portfolio drawdown; CRM or market-connector integration; CBK monetary-policy event timelines; macroeconomic datasets; cross-market correlations and regime analysis; separate historical curve replay; and report export. Server-side role and permission enforcement now exists for portfolio writes, risk execution, ingestion controls, and audit access.

The following areas are explicitly demo or sample: the derivative card’s example inputs. The resulting price and Greeks are live Python-engine calculations for those inputs, but the inputs are not claimed to be live market data.

The following areas still require production hardening: production deployment and Heartbeat task registration; shared rate-limit storage if horizontally scaled; MFA and email-verification policy if required by deployment; centralized operational monitoring; backups; and eventual separation of the Python service when synchronous process calls no longer meet latency or reliability requirements. Request IDs, secure headers, endpoint-class rate limits, audit logs, role permissions, portfolio ownership, and risk lineage are now implemented in the current foundation.

The application currently contains Framer Motion and Recharts for the visual layer. No separate React Bits package was detected in the repository. Motion has been used selectively for data-details disclosure and responsive interactions. A future React Bits adoption should remain an interaction-layer enhancement and must not become a source of financial values.

## 8. Recommended Git repository structure

The current tree is serviceable for development. A professional repository should evolve toward this structure without deleting the existing modules:

```text
fintel/
├── client/
│   └── src/
│       ├── components/
│       │   ├── fintel/
│       │   ├── layout/
│       │   └── ui/
│       ├── pages/
│       ├── lib/
│       └── contexts/
├── server/
│   ├── api/
│   ├── ingestion/
│   ├── quant_engine/
│   ├── services/
│   ├── auth/
│   ├── db.ts
│   ├── routers.ts
│   └── scheduler.ts
├── drizzle/
│   ├── schema.ts
│   └── migrations/
├── scripts/
├── docs/
│   ├── architecture.md
│   ├── data-sources.md
│   ├── methodology.md
│   └── research-products.md
├── tests/
│   ├── ingestion/
│   ├── api/
│   ├── quant/
│   └── security/
├── .github/
│   └── workflows/
└── README.md
```

The immediate repository tasks are to add a root README, document the data-status contract, expand security and authorization tests, and introduce clear commits per capability. Secrets and database credentials must remain environment-managed.

## 9. Recommended implementation order

The next technical milestone is deployment-gated activation of the source-specific scheduled jobs and verification of their callback logs. After that, FINTEL can add historical yield-curve replay, market-event timelines, cross-market analytics, and separately routed research workspaces. Portfolio risk now resolves instrument-appropriate observed series and preserves explicit no-data states; it no longer uses a generic or fabricated history.

Visual refinement should follow the data and security milestones. The current terminal identity is already distinct and Kenyan through CBK, KES, Treasury, Nairobi, and yield-curve context. Additional animation should only represent a new validated observation entering the database and should remain disabled or reduced under `prefers-reduced-motion`.

## References

[1]: https://www.centralbank.go.ke/forex/ "Central Bank of Kenya foreign exchange page"
[2]: https://www.centralbank.go.ke/bills-bonds/treasury-bills/ "Central Bank of Kenya Treasury Bills page"
[3]: https://www.centralbank.go.ke/bills-bonds/treasury-bonds/ "Central Bank of Kenya Treasury Bonds page"
[4]: https://www.centralbank.go.ke/financial-markets/ "Central Bank of Kenya financial markets page"
