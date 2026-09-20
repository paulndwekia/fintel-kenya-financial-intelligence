# FINTEL Historical Data Policy

1. Observed market data is persisted with observation date, retrieval timestamp, source and quality metadata where available.
2. A retrieval timestamp is not an observation date.
3. Re-running an ingestion job for the same observation must not create a second canonical row.
4. Existing historical observations are not overwritten merely because a source was retrieved again.
5. Invalid or quarantined observations are not promoted to validated analytics data automatically.
6. Risk analytics must not create synthetic historical observations when required history is unavailable.
7. If required history is missing, the API must expose `DATA REQUIRED` or an equivalent explicit insufficiency status.
8. Historical coverage should be reported as observed coverage, not inferred or simulated coverage.
