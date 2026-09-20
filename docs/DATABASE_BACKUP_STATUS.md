# FINTEL Database Backup Status

## Status

**DATABASE DATA BACKUP STATUS: NOT COMPLETED.**  
**DATABASE SCHEMA BACKUP STATUS: COMPLETE.**  
**Backup type:** SCHEMA ONLY.

FINTEL uses MySQL/TiDB through Drizzle ORM. The repository contains the authoritative schema and additive migrations. A source archive does not contain database rows, user records, market observations, portfolio positions, audit logs, or ingestion history.

A read-only schema export was created with the runtime database connection using `mysqldump --no-data` over TLS. The first attempt exposed an unsupported TiDB savepoint behavior; the exporter was corrected by removing the transaction flag and the second attempt succeeded. The resulting file is `backups/fintel-schema-2026-09-20.sql`. It is verified to contain no `INSERT INTO` statements and is included in the portable package.

## What is included

The portable package includes `drizzle/schema.ts`, generated migration SQL and snapshots, `backups/fintel-schema-2026-09-20.sql`, and this status document. The schema dump contains table definitions only. It contains no passwords, connection URLs, application secrets, or data rows.

## What is not included

No credentials, private user information, production data dump, live portfolio data, market observations, audit rows, or ingestion history are included. A complete data backup requires an approved managed-database backup/export workflow and retention policy. It is not guessed or simulated here.

## Restore boundary

Restore the schema in a disposable or approved target first. Review migrations and schema compatibility before applying to any production database. Restore data only from an approved managed backup, then re-run FINTEL health checks and verify source lineage.
