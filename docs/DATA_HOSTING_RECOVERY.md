# FINTEL PostgreSQL hosting and data operations

## Source of truth

- Application: FINTEL — Kenya Financial Intelligence
- Repository: https://github.com/paulndwekia/fintel-kenya-financial-intelligence
- Runtime: Render web service `fintel-kenya-financial-intelligence`
- Database provider: Neon PostgreSQL
- Neon project: `FINTEL` (`frosty-fog-99785728`)
- Region: AWS Europe Central 1 (Frankfurt), matching the Render service region
- Database: `fintel`
- PostgreSQL major version: 18
- Default branch: `main`

Neon is the authoritative database for FINTEL. StandPoint has its own separate Neon project and must never be changed by FINTEL operations.

## Clean start decision

On 10 November 2026, the owner chose to start FINTEL with fresh data rather than recover the old Aiven MySQL records. No MySQL dump is imported. The new schema is created from `drizzle/schema.ts`; the live application must not connect to Aiven.

The first database bootstrap is intentionally empty. FINTEL's verified source connectors populate the new tables from official Central Bank of Kenya publications and datasets. User portfolios, research sessions and old audit history are not carried forward.

## Application database implementation

- Drizzle ORM PostgreSQL schema: `drizzle/schema.ts`
- Runtime driver: `pg` with `drizzle-orm/node-postgres`
- Runtime connection variable: `DATABASE_URL` (set as a Render secret; never commit it)
- Schema synchronization: the Docker start command runs `drizzle-kit push` before starting the API
- PostgreSQL generated IDs use `RETURNING`, not MySQL `insertId`
- User upserts use PostgreSQL `ON CONFLICT`
- Duplicate-key classification uses PostgreSQL SQLSTATE `23505`

Do not set Render's `DATABASE_URL` to a PostgreSQL URL until this PostgreSQL-compatible application release is deployed. A MySQL connection string is not compatible with the PostgreSQL driver.

## Data refresh schedule

The repository includes `.github/workflows/fintel-data-refresh.yml`. It uses GitHub Actions OpenID Connect (OIDC) to authenticate scheduled requests to the FINTEL API. There is no long-lived cron password or database credential in GitHub.

Schedule (UTC):
- Weekdays at 06:15 — CBK daily market, FX, key rates and Treasury Bill observations
- Weekdays at 10:30 — CBK Treasury Bill auction data
- Weekdays at 11:00 — CBK Treasury Bond auction/document refresh
- Sundays at 02:00 — historical FX and Treasury Bill backfill refresh

Kenya is UTC+3. The workflow can also be run manually from GitHub Actions using `workflow_dispatch`. Requests are accepted only when the JWT is issued by GitHub Actions and its repository ID, repository, main branch and exact workflow reference match this FINTEL repository.

The API endpoint remains `/api/scheduled/cbk-ingestion`. The `source` query parameter is checked against the known ingestion schedule before any ingestion is run.

## Health and readiness

- `GET /api/system/health` reports whether the web process is running.
- `GET /api/system/readiness` performs a database connectivity check and returns HTTP 200 only when PostgreSQL responds to `SELECT 1`.
- Neither endpoint returns credentials, connection strings, usernames, hostnames or raw database errors.

After deployment, verify both endpoints and confirm that CBK records are being inserted and that source timestamps advance after successful refreshes.

## Free-tier limits and resilience boundary

The initial Neon project is on the Free plan. Its current project settings show a 1 GiB logical storage limit, 100 compute-hours per month, a 0.25–1 CU compute range and six hours of restore history. The compute may suspend while idle; the first request after idle may take longer while it wakes.

This is a cost-controlled starting point, not a production SLA. Six-hour point-in-time history is not a substitute for independent backups. Before relying on FINTEL for critical decisions or growing user data, add scheduled encrypted logical backups in a separate storage account, test restores, and review Neon paid-tier cost/availability options. No paid tier or service has been approved or activated by this change.

## Operational rules

1. Keep the Neon project and Render service dedicated to FINTEL.
2. Never commit `DATABASE_URL`, passwords, API keys or OIDC tokens.
3. Keep the old MySQL schema archive labelled as legacy only; it is not the new database schema source.
4. Do not create fake or illustrative market observations. If official ingestion fails, keep the source status in an error/data-required state.
5. Do not advertise a source as current until the database has stored and read back validated observations.
6. Check GitHub Actions run history, source health and Render readiness when data appears stale.
