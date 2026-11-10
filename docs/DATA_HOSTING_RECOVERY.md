# FINTEL data-hosting recovery

## Production environment identified

- Application: Render web service fintel-kenya-financial-intelligence
- Repository: paulndwekia/fintel-kenya-financial-intelligence
- Current application data engine: MySQL/TiDB through Drizzle mysql2
- Configured connection host observed in production errors: fintel-mysql-fintel.e.aivencloud.com
- Current failure: Node's MySQL driver reports getaddrinfo ENOTFOUND while trying to resolve that host.
- The web application can still start, but the database-backed source registry, CBK observations, portfolio persistence and research session persistence cannot be relied upon until the database connection succeeds.

The value of DATABASE_URL is managed as a Render secret. It is not read from source control and should never be pasted into a public issue or committed file.

## Why the hostname must be checked at Aiven

Aiven assigns a full service hostname that includes a DNS-zone component. The component is assigned by Aiven and can vary. Aiven explicitly recommends copying the fully qualified hostname returned by the Aiven Console/API rather than reconstructing it from the service and project names: https://aiven.io/docs/platform/reference/service-ip-address.

The current configured host does not resolve from the live Render service. This is not a password or SQL-schema error. It is a DNS/endpoint failure that must be resolved before authentication or table queries can succeed.

## Critical Aiven MySQL timeline

Aiven has announced retirement of the free MySQL tier:
- From 6 November 2026, new free MySQL services can no longer be created.
- On 21 December 2026, any remaining free MySQL services will be powered off and their data and backups deleted.

Official notice and migration choices: https://aiven.io/docs/products/mysql/howto/mysql-free-tier-migration-options.

The app's current MySQL schema cannot be pointed directly at a PostgreSQL service. Moving to PostgreSQL requires a reviewed Drizzle schema/driver migration and a data export/import. Do not change the Render connection string to PostgreSQL until that migration has been implemented and validated.

## Backup boundary

The repository currently includes a verified schema-only backup from 20 September 2026. It does not include data rows, market observations, portfolios, research sessions, audit rows, or ingestion history. See DATABASE_BACKUP_STATUS.md.

A full export must be made from the live MySQL service while it is still accessible. A Windows PowerShell helper is provided at scripts/backup-fintel-mysql.ps1. It:
- Reads a MySQL URI from the current PowerShell environment.
- Creates a temporary, current-user-only client defaults file for the dump.
- Uses TLS and mysqldump with transaction, routine, trigger and event options.
- Stores the export locally and prints a SHA-256 checksum.
- Deletes the temporary credential file when it finishes.

The output may contain personal portfolio and research information. Keep it private, outside Git, and in encrypted storage. Do not upload it to a public issue or commit it.

## Recovery sequence

1. Sign in to the Aiven Console and open the FINTEL MySQL service.
2. Check that the service exists and is in a running state. Open Quick connect and copy the current hostname, port, database, username and connection URI exactly as supplied by Aiven. Do not build the hostname manually.
3. If the service is still accessible, immediately create and verify a full data export using the PowerShell helper. Preserve the export and checksum separately from this repository.
4. Once the correct Aiven endpoint is confirmed, update only the FINTEL Render service's DATABASE_URL environment variable. Do not touch the Render service or database named StandPoint.
5. Redeploy FINTEL, then check /api/system/readiness. It must report ready and database.status = connected.
6. Run the CBK ingestion workflow after readiness is restored. Re-ingest public CBK series only after confirming the database can persist and read data.
7. Before 21 December 2026, decide whether to retain paid MySQL, migrate to Aiven PostgreSQL, or use another managed PostgreSQL provider. If using PostgreSQL, first complete and test the schema/driver conversion and data import on a separate target. Retain the MySQL export until row counts and important portfolio/research records have been reconciled.

## Current safe choices

- Restore the official current Aiven MySQL endpoint first if the old service exists. This has the best chance of preserving all existing records with the least application change.
- Do not create a temporary Render Free Postgres database for production. Render states that Free Postgres expires after 30 days, has no backups, and is not intended for production: https://render.com/docs/free.
- Do not migrate blindly to Supabase. Its Free plan provides 500 MB per project, no automatic backups, and pauses projects after about a week of low activity: https://supabase.com/docs/guides/platform/free-project-pausing. A Postgres driver/schema migration is still required.

## Readiness endpoint

GET /api/system/health is a liveness check and stays available while the database is being repaired.

GET /api/system/readiness performs a safe connectivity probe and returns:
- 200 with status ready when the database accepts a SELECT 1;
- 503 with a non-sensitive status code when configuration is missing or the host/connection is unavailable.

It never returns the database URL, hostname, username, password or raw driver error.
