# FINTEL database backup and recovery status

## Current database

FINTEL now uses a fresh PostgreSQL database in the dedicated Neon project `FINTEL`. The owner explicitly selected a clean start on 10 November 2026. No old Aiven MySQL rows are being imported.

The old file `backups/fintel-schema-2026-09-20.sql` is a historical, schema-only MySQL archive. It is not used to create the new PostgreSQL database and contains no production rows.

## Fresh-start bootstrap

The PostgreSQL schema in `drizzle/schema.ts` is the source of truth. The deployment runs Drizzle's PostgreSQL schema push before starting the application. Official CBK ingestion workflows create the fresh market-data history as source records are fetched and validated.

## Backup status

- PostgreSQL schema: version-controlled in `drizzle/schema.ts`.
- Neon point-in-time restore history: configured for six hours on the current Free project.
- Independent encrypted logical backup: NOT YET CONFIGURED.
- Restore drill: NOT YET COMPLETED.
- Old Aiven user, portfolio, audit and research records: intentionally not imported.

Six-hour restore history protects against some recent mistakes but is not an independent backup. Do not describe FINTEL as having a complete disaster-recovery backup until an encrypted export is stored outside Neon and a restore has been tested.

## Next resilience gate

Before critical production use:
1. Configure scheduled `pg_dump` backups to a separate private object-storage account.
2. Encrypt backup artifacts before upload and restrict access to the application owner.
3. Retain daily and weekly versions with a defined retention policy.
4. Verify SHA-256 checksums and run a restore test into a disposable Neon branch/project.
5. Document recovery time and recovery point objectives.

No paid backup destination or provider upgrade is enabled by this change.
