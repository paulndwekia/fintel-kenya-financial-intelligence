# FINTEL Current Feature Inventory

## Working

The command-centre shell, responsive dark terminal styling, source-lineage disclosures, authentication integration, server-side role permissions, API request security, CBK current ingestion, Treasury Bill parsing, Treasury Bond PDF parsing, FX ingestion, historical backfill infrastructure, persisted yield-curve observations, Python bond analytics, Black-Scholes, CRR, Monte Carlo, Greeks, model registry, data-health API, scheduler callback contract, audit event persistence, rate-limit middleware, tests, TypeScript checks, and production build are working at the verified checkpoint.

The live preview is available through the saved WebDev checkpoint. Public market and health endpoints respond with persisted CBK states. Protected portfolio routes reject unauthenticated requests.

## Partially working

The sidebar workspaces are present, but several are structural views inside the command-centre page rather than separate routed workspaces. Portfolio creation and position entry now exist for authorised users, but external CRM, custody, or portfolio-file ingestion is not connected. Portfolio risk becomes useful only after positions and aligned instrument histories exist. Treasury Bond parsing captures the published result fields but not every prospectus detail. Historical analytics exists for available series but is not yet a complete replay system.

## DATA REQUIRED

CRM and sales analytics data, live news and CBK event timelines, macroeconomic datasets, cross-market correlation feeds, historical curve replay coverage, report export data, user-specific portfolio positions, and full instrument-specific historical series are not connected. The derivative card remains a labelled `DEMO / SAMPLE INPUTS` example.

## Planned

FINTEL Academy, AI research workspace, multi-provider AI, React Bits visual identity, living market graphs, historical market replay, subscription/business infrastructure, formal monitoring and alerting, shared rate-limit storage, MFA policy, and production backup/restore operations remain future work.
