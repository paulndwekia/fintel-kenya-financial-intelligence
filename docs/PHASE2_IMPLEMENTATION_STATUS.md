# FINTEL Phase 2 Implementation Status

## Implemented
- Authenticated `/research` workspace.
- Persisted research sessions and messages.
- Owner-scoped session read/delete.
- FINTEL database context retrieval.
- Controlled market-data tool.
- Controlled bond-analytics tool.
- Controlled derivative-pricing tool.
- Controlled portfolio-risk-readiness tool with owner scoping.
- Existing server-side LLM adapter reused.
- AI tool-call loop limited to three turns.
- Evidence/provenance persisted with assistant messages.
- Existing audit log used for research execution.
- Explicit DATA REQUIRED behavior for missing FINTEL evidence.

## Not implemented in this phase
- External web search provider.
- PDF/DOCX extraction and page-level retrieval.
- Multi-provider comparison.
- Academy.
- React Bits redesign.

These remain subsequent phases and are not represented as connected features in the UI.
