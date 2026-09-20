# FINTEL Database Integrity — Phase 1

## Purpose

FINTEL stores observations that must remain distinguishable across years of ingestion. Phase 1 adds database-level uniqueness for the principal natural keys and indexes the query paths used by ingestion, historical analytics, portfolios, risk results and audit operations.

## Natural keys

| Dataset | Natural key | Reason |
|---|---|---|
| Data sources | `name` | One canonical source record per configured source name. |
| Market data | `instrument + observationDate` | One validated observation per instrument/day in the current canonical source model. |
| FX | `pair + observationDate` | One canonical daily FX observation per pair. |
| Treasury Bills | `tenorDays + auctionDate` | One auction observation per tenor/date. |
| Treasury Bonds | `duplicateKey` | The bond parser already constructs `securityCode + auction date`. |
| Historical prices | `instrument + observationDate` | One historical observation per instrument/day. |
| Yield curve | `tenor + curveDate` | One observed curve point per tenor/date. |

Retrieval time is intentionally not part of these keys: retrieving the same market observation again must be idempotent.

## Ingestion behavior

Application-level duplicate checks remain in place for fast-path detection. Database unique constraints provide the final race-safe protection. A concurrent duplicate insert is caught as a duplicate and counted rather than replacing the original historical observation.

Historical observations are not updated merely because the same observation is retrieved again.

## Migration safety

Before applying migration `0007_fintel_integrity_hardening.sql`, run:

```bash
pnpm tsx scripts/check-database-integrity.ts
```

The preflight must report no duplicate groups. The migration is intentionally additive and does not delete rows.

If duplicates are found, review them before applying the migration. Do not delete data automatically to make the migration pass.

## Query indexes

Phase 1 also indexes:

- source health and scheduler fields
- ingestion run history
- historical observation series
- Treasury Bill auctions
- Treasury Bond security/auction lookups
- yield-curve dates
- portfolio ownership/status
- portfolio positions
- risk-result history
- audit-log actor/resource history

These indexes are intended to keep FINTEL responsive as the historical database grows.
