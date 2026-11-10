# FINTEL Current Feature Inventory

This inventory describes the application code, not a claim that every external source or production integration is currently healthy.

## Working application capabilities

- Responsive FINTEL command centre with a dedicated Kenyan-market visual system (forest ink, jade, warm brass, clay and orchid accents).
- React Bits-inspired spotlight lighting and restrained entrance motion, with reduced-motion support.
- Real Nairobi and Kenya photography with visible photographer credits; see `docs/PHOTOGRAPHY_CREDITS.md`.
- Explicit routes for market observations, yield curve, fixed income, derivatives, risk, portfolio, models, data sources, settings, about, research, Academy and legal pages.
- CBK FX, key-rate, Treasury Bill and Treasury Bond read paths backed by persisted observations when the configured ingestion workflow has run successfully.
- Frontend market queries refresh their saved-data view periodically; this is not a streaming exchange quote feed. Source cadence and the CBK publication schedule determine when new observations exist.
- Python bond analytics, yield-curve interpolation, Black-Scholes, CRR, Monte Carlo and Greeks.
- Owner-scoped portfolio creation and position entry for permitted roles; risk analytics still depends on real holdings and aligned historical instrument observations.
- Authenticated AI research sessions, selected FINTEL context, quantitative tools and evidence/provenance display.
- Learning resource directory linking to official CBK and IMF material.
- Cookie preference panel, privacy notice, terms of use, cookie policy, financial disclaimer and security overview.
- Existing request validation, session handling, role permissions, security headers, rate limits and audit logging.

## Partially connected or dependent on configuration/data

- CBK refresh depends on the scheduled GitHub Actions workflow and its deployment secrets. The existence of a workflow file does not prove that a successful production run has occurred.
- Treasury Bond parsing covers published result fields but not every prospectus field.
- Historical analytics is limited to available, validated series; a full historical curve replay system is not complete.
- Portfolio risk is useful only after authorised positions and aligned price histories exist.
- AI research requires a configured provider and valid server-side credentials.
- Cookie analytics and personalisation preferences can be saved, but no optional analytics tracker is enabled by this release.

## DATA REQUIRED / not represented as live features

CRM and custody integrations, real-time exchange/tick feeds, live market news and CBK event timelines, broader macroeconomic datasets, cross-market correlation feeds, a full backtesting/replay workspace, report export and subscription infrastructure remain unconnected or incomplete. The app must continue to label those gaps clearly rather than show sample values as live data.

## Production verification still required

A passing typecheck, test suite and production build must be obtained for the release branch. After merge, the Render deployment must finish successfully and the public site must be checked for route, auth, market-data and responsive behaviour.
