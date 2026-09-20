# FINTEL Current Data Status

This snapshot records the state observed during the 20 September 2026 preservation handoff. Values are intentionally not copied into this document because live observations belong in the database and API responses.

| Area | Status | Last observation / retrieval | Source | Quality | Limitation |
| --- | --- | --- | --- | --- | --- |
| CBK market/key rates and FX | CURRENT in live preview | See `/api/data/health` response | Official CBK pages | Validated persisted rows | Freshness depends on official publication cadence |
| Treasury Bills | CURRENT in live preview | See `/api/data/health` response | Official CBK auction and average-rate pages | Validated persisted rows | Auction cadence |
| Treasury Bonds | CURRENT / partially parsed | See `/api/data/health` response | Official CBK auction-result PDFs | Validated/rejected counts and source documents | Full prospectus details are not all parsed |
| FX history | PARTIALLY CONNECTED | See historical coverage API | Official CBK historical dataset | Observed and deduplicated | Instrument coverage varies |
| Yield curve | CURRENT in live preview | See `/api/yield-curve` response | Persisted CBK bill/bond observations | Observed points passed to Python interpolation | Historical replay is not complete |
| Historical database | PARTIALLY CONNECTED | See `/api/historical-market-data` | FINTEL historical tables | Observed-only analytics | Some instrument-specific series remain DATA REQUIRED |
| Portfolio data | DATA REQUIRED until user positions are created | No default portfolio is seeded | Authorised user or future CRM/custody connector | No fabricated values | Current UI supports controlled entry; CRM is not connected |
| Portfolio risk | DATA REQUIRED without positions and aligned history | On-demand only | FINTEL portfolio database + Python engine | Lineage persisted when calculated | No synthetic history fallback |

For exact timestamps, counts, rejected rows, duplicates, source URLs, and errors, query the live health endpoint rather than relying on this static handoff document. No values in this file should be interpreted as a market-data snapshot.
