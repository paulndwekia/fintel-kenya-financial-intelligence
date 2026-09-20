# FINTEL Phase 1B — Risk Readiness and Ingestion Monitoring

## Implemented

- Ingestion runs now persist a dedicated duplicate count.
- Added recent ingestion-run API visibility.
- Added portfolio risk-readiness evaluation based on persisted positions and validated historical observations.
- Added authenticated REST endpoint `/api/portfolio/:portfolioId/risk-readiness`.
- Added tRPC `portfolio.riskReadiness`.
- Data-health database status now reflects persisted source states instead of unconditionally reporting CURRENT.
- Added targeted database indexes for ingestion monitoring and position-date queries.

## Risk boundary

Historical VaR/ES/drawdown require validated observed history. FINTEL must return DATA REQUIRED when required instrument histories are unavailable. Parametric risk may remain available where the model inputs are valid, but it must not be represented as historical risk.

## Production configuration still required

The CBK scheduler still requires deployment-level callback registration and external production configuration. This build does not claim those jobs are activated.
