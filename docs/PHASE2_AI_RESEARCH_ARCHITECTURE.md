# FINTEL Phase 2 — AI Research Architecture

Implemented as an incremental layer over the existing FINTEL platform.

## Implemented
- Authenticated research sessions and messages.
- Dedicated `/research` workspace.
- Research modes: MARKET, QUANT, RISK, FIXED INCOME, MACRO, PORTFOLIO, ACADEMIC, GENERAL FINANCE.
- Server-side FINTEL evidence retrieval for market data, FX, Treasury Bills, Treasury Bonds and yield curve.
- Historical-series retrieval when an instrument is explicitly present.
- Provider-neutral use of the existing LLM adapter.
- Provenance/evidence and limitation fields persisted with assistant messages.
- Research audit logging.
- Ownership checks for research sessions.

## Integrity rules
The AI layer cannot directly execute SQL. It consumes server-side typed data retrieval. Missing FINTEL data is reported as DATA REQUIRED rather than replaced with synthetic values.

## Not yet implemented
- External web-search provider adapter.
- PDF/DOCX content extraction and citation-level retrieval.
- Multi-provider model comparison.
- Quant tool-calling loop for arbitrary user-selected calculations.
- Academy UI.

These are intentionally subsequent increments.
