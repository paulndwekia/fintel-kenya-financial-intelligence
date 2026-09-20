# FINTEL Next Development Phase

This is a handoff roadmap. None of these phases is implemented by the preservation task.

1. **Persisted portfolios.** Complete the controlled portfolio-entry and source-import workflow for authorised users.
2. **Instrument-specific historical series.** Ensure each portfolio instrument maps to validated historical observations.
3. **Historical portfolio risk.** Activate VaR, expected shortfall, drawdown, stress, and backtesting once aligned series exist.
4. **Production CBK ingestion schedules.** Deploy first, register four Heartbeat tasks, persist task UIDs, enable the scheduler, and verify callback logs.
5. **Data-health monitoring.** Add operational alerting, stale-source views, and ingestion-run review.
6. **Role-based workspace authorization.** Extend current permission enforcement to every workspace action and route.
7. **Audit logs.** Add an authorised review surface and retention policy.
8. **Rate limiting and security hardening.** Move buckets to shared storage, restrict CORS, add dependency scanning, and formalize incident controls.
9. **FINTEL Academy.** Build only after the production data boundary is stable.
10. **FINTEL AI Intelligence / Research Workspace.** Keep AI outputs distinct from market-data truth and model calculations.
11. **Multi-provider AI integrations.** Add only with explicit secret and data-governance boundaries.
12. **React Bits Kenyan visual identity.** Treat as a visual-layer enhancement, not a financial-data source.
13. **Living market graphs.** Add data-driven motion after freshness and lineage are observable.
14. **Historical market replay.** Build on persisted time-series coverage and curve snapshots.
15. **Client, subscription, and business infrastructure.** Add only after access, audit, billing, and data-governance requirements are defined.

The safe immediate step after this backup is to restore the archive in a separate development environment, supply local environment values, run the verification commands, and review the schema-only database backup before any migration or production deployment.
