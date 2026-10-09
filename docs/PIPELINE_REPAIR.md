# FINTEL Data Pipeline Repair

## Findings fixed in this code revision

1. The CBK Forex page contains historical/archive FX rows before the current `Daily KES Exchange Rates` block. The old parser used the first matching currency number and the first date in the page, which could persist old values as current. The parser now anchors on the last current FX heading, reads the date from `Posted On`, and parses key-rate dates individually.
2. The previous T-Bill parser read the `Treasury Bills on Offer` page, where the next auction date sits alongside a previous average rate. Those fields do not describe the same observation. The pipeline now reads CBK's `Treasury Bills Average Rates` table and selects the latest available row for each 91/182/364-day tenor.
3. Treasury Bill observations now have a separate `issueDate`; they no longer store the source's issue date as an auction date. The schema change is additive and has a migration file at `drizzle/0010_treasury_bill_issue_date.sql`.
4. Ingestion is marked `ERROR` when the expected FX/key-rate or 91/182/364-day observations are missing. The callback script previously sent `GET` requests even though Express registers the protected ingestion endpoint as `POST`; it now uses `POST`. It also fails a workflow run when the API returns an ingestion error, even if the HTTP response itself is 200.
5. A GitHub Actions workflow is included to invoke the existing protected ingestion callback. It schedules weekday current data and a weekly Treasury Bond update. The larger historical backfill is manual-only so it does not repeatedly scan thousands of historical rows during each scheduled run.
6. The main tRPC dashboard query previously returned up to 100 historical rows in database order, allowing older market observations to crowd out FX/T-Bill cards and reporting the aggregate as current whenever any row existed. It now picks the latest observation per instrument/pair, orders the core Kenya indicators first, calculates freshness by the observation cadence, and avoids using the Forex landing-page T-Bill tile. The dashboard header clock now uses the current Africa/Nairobi time instead of a hardcoded date.
7. Treasury Bond ingestion now records inserted/duplicate/rejected counts after persistence and reports partial parsing or validation failures as `STALE` instead of marking a partial run `CURRENT`.

## Data sources

- FX and key rates: <https://www.centralbank.go.ke/forex/>
- Treasury Bill average rates: <https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/>
- Treasury Bond results: <https://www.centralbank.go.ke/bills-bonds/treasury-bonds/>

CBK publication frequency differs by series. The dashboard should describe values as the latest *published* observations, not exchange-style real-time quotes.

## Required deployment setup

### Render service

Add `CBK_CRON_SECRET` as an environment variable in the Render service. It must match the GitHub repository secret exactly. Use a long random value, do not commit it, and do not paste it into issue reports. Keep `CBK_SCHEDULER_ENABLED=true` to mark the schedule metadata as enabled.

### GitHub repository

In **Settings → Secrets and variables → Actions**:

- Add repository variable `FINTEL_BASE_URL` with the public Render URL, for example `https://fintel-kenya-financial-intelligence.onrender.com` (no trailing slash required).
- Add repository secret `CBK_CRON_SECRET` using the same value configured on Render.

Then open **Actions → FINTEL CBK Data Pipeline → Run workflow**. The first manual run defaults to current rates and bonds; historical backfill is opt-in. Confirm the run succeeds and inspect `/api/data/health`, `/api/system/status`, and `/api/scheduler/status`.

GitHub scheduled workflows run from the repository's default branch. The first schedule may take time to trigger; use `workflow_dispatch` for immediate verification.

## Database change

Before production deployment, take a database backup. The existing Render startup command uses `drizzle-kit push`, which may apply the `issueDate` schema change during deploy. Alternatively, apply the additive SQL migration in `drizzle/0010_treasury_bill_issue_date.sql` through the team's reviewed database migration process. Do not drop/reset the production database. Validate the migration and schema against a non-production database first if available.

Existing rows are retained. Legacy rows may have `issueDate = NULL` and old values previously associated with `auctionDate`; this change does not silently rewrite their historical provenance. New observations will use the corrected date semantics.

## Verification checklist

1. Run parser unit tests for the archive-vs-current FX case and latest-per-tenor T-Bill selection.
2. Deploy the revised code and verify the Render health endpoint.
3. Run the GitHub Actions workflow manually.
4. Check that source status is not reported `CURRENT` if expected observations are missing.
5. Check `/api/market/fx` and `/api/market/treasury-bills`; confirm observation dates, source URL and retrieval timestamps.
6. Check `/api/data/health` for last successful update, rejected rows, duplicates and errors.
7. Confirm a weekday workflow and weekly bond workflow have succeeded before relying on automatic refresh.
