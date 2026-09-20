# FINTEL Data Lineage

FINTEL treats market data as source-backed observations rather than decorative dashboard values. Every connected observation should retain its source, timestamps, validation state, and ingestion status.

## Status vocabulary

**CONNECTED** means the source or calculation is implemented and current persisted rows are available. **PARTIALLY CONNECTED** means only some source documents, fields, or downstream workflows are connected. **DATA REQUIRED** means a required source, credential, user position, or aligned history is absent. **DATA STALE** is used when a row exists but falls outside its expected cadence. **BACKEND OFFLINE** means the database or calculation backend cannot be reached.

## Lineage matrix

| Domain | Source and path | Stored metadata | Current status | Limitation |
| --- | --- | --- | --- | --- |
| CBK key rates and FX | Official CBK forex/rates pages via `server/ingestion/cbk.ts` | Observation date, publication/retrieval timestamps, frequency, currency, source URL, raw value, quality | CONNECTED | Source cadence and page availability can vary |
| FX history | Official CBK historical CSV via `phase2.ts` | Instrument, observed value/date, source URL, retrieval timestamp, quality, duplicate checks | CONNECTED / PARTIALLY CONNECTED | Historical coverage is source-dependent |
| Treasury Bills | Official CBK Treasury Bill auction and average-rate pages | Tenor, auction date, weighted-average rate, source and retrieval lineage, validation status | CONNECTED | Auction publication cadence governs freshness |
| Treasury Bonds | Official CBK auction-result PDFs | Security code, ISIN where parsed, issue/maturity, coupon, yields, amounts, document URL, raw text, duplicate key, validation status | PARTIALLY CONNECTED | Prospectus-level fields are not fully parsed |
| Yield curve | Persisted validated bill/bond points passed to Python interpolation | Tenor, maturity years, yield, curve date, source ID, source lineage, quality | CONNECTED | Historical replay/curve comparison is not complete |
| Historical market database | `historical_prices` and related source definitions | Instrument, price, date, source, quality, retrieval and observation timestamps | PARTIALLY CONNECTED | Instrument-specific series must be present for portfolio history |
| Portfolio data | Authorised user entry through tRPC and Drizzle tables | Owner ID, portfolio ID, position fields, position date, currency, model inputs | PARTIALLY CONNECTED | CRM/custody integration is DATA REQUIRED |
| Risk data | Existing positions and Python engine outputs persisted to `risk_results` | Method, confidence, horizon, VaR/CVaR, stress, calculation time, lineage JSON | PARTIALLY CONNECTED | No positions means no portfolio risk; missing history returns DATA REQUIRED |

## Freshness and validation

`data_sources` records expected frequency, latest observation, last attempted and successful updates, next scheduled time, record counts, rejected counts, duplicates, progress, errors, schedule task UID, and quality. REST endpoints classify freshness according to source cadence. Current CBK refreshes persist new observations without replacing historical series.

CBK parsers reject invalid values and preserve raw source text where applicable. Treasury Bond records that fail required validation are retained as rejected counts or review candidates rather than promoted to live analytics. Duplicate detection uses the instrument/date or source-specific duplicate key before persistence.

## Portfolio and risk lineage

Portfolio positions are owner-scoped. Risk calculations identify the portfolio, method, confidence, horizon, number of aligned observations, missing instruments, and calculation timestamp. Historical VaR, expected shortfall, and drawdown use observed prices only. No synthetic fallback history is used.

## Data boundaries

The derivative card in the current terminal is **DEMO / SAMPLE INPUTS**. Its calculated outputs come from the Python engine, but the spot, strike, tenor, rate, and volatility values are analyst examples. CRM, news/events, macro datasets, cross-market relationships, and custody data are **DATA REQUIRED** rather than fabricated.
