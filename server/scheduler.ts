import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { CBK_URLS, fetchCbkBatch, fetchWithRetry } from "./ingestion/cbk";
import { fetchTreasuryBillResultDocuments, fetchTreasuryBondDocuments, parseHistoricalFxCsv, parseHistoricalTreasuryBillHtml } from "./ingestion/phase2";
import { getDataSourceByTaskUid, persistCbkBatch, persistHistoricalObservations, persistTreasuryBondBatch, recordIngestionRun, upsertDataSource } from "./db";
import { sdk } from "./_core/sdk";

const GITHUB_ACTIONS_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_ACTIONS_AUDIENCE = "https://fintel-kenya-financial-intelligence.onrender.com";
const GITHUB_ACTIONS_WORKFLOW_REF = "paulndwekia/fintel-kenya-financial-intelligence/.github/workflows/fintel-data-refresh.yml@refs/heads/main";
const GITHUB_ACTIONS_REPOSITORY_ID = "1378400184";
const githubActionsJwks = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

async function isTrustedGitHubActionsRun(req: Request): Promise<boolean> {
  const authorization = req.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) return false;

  try {
    const { payload } = await jwtVerify(match[1], githubActionsJwks, {
      issuer: GITHUB_ACTIONS_ISSUER,
      audience: GITHUB_ACTIONS_AUDIENCE,
    });
    return payload.repository === "paulndwekia/fintel-kenya-financial-intelligence"
      && String(payload.repository_id ?? "") === GITHUB_ACTIONS_REPOSITORY_ID
      && payload.ref === "refs/heads/main"
      && payload.workflow_ref === GITHUB_ACTIONS_WORKFLOW_REF
      && (payload.event_name === "schedule" || payload.event_name === "workflow_dispatch" || payload.event_name === "push");
  } catch {
    return false;
  }
}

export const INGESTION_SCHEDULES = [
  { name: "CBK daily market data", sourceName: "CBK key rates and FX", frequency: "DAILY", cron: "0 15 6 * * *", path: "/api/scheduled/cbk-ingestion" },
  { name: "CBK Treasury Bill auction data", sourceName: "CBK Treasury Bills", frequency: "AUCTION", cron: "0 30 10 * * 1-5", path: "/api/scheduled/cbk-ingestion" },
  { name: "CBK Treasury Bond auction data", sourceName: "CBK Treasury Bonds", frequency: "AUCTION", cron: "0 0 11 * * 1-5", path: "/api/scheduled/cbk-ingestion" },
  { name: "CBK historical FX backfill", sourceName: "Historical market database", frequency: "BACKFILL", cron: "0 0 2 * * 0", path: "/api/scheduled/cbk-ingestion" },
] as const;

function nextScheduledAt(sourceName: string, from = new Date()) {
  const next = new Date(from);
  if (sourceName === "CBK key rates and FX") next.setUTCDate(next.getUTCDate() + 1);
  else if (sourceName === "Historical market database") { const daysUntilSunday = (7 - next.getUTCDay()) % 7 || 7; next.setUTCDate(next.getUTCDate() + daysUntilSunday); }
  else { do { next.setUTCDate(next.getUTCDate() + 1); } while (next.getUTCDay() === 0 || next.getUTCDay() === 6); }
  next.setUTCHours(sourceName === "CBK key rates and FX" ? 6 : sourceName === "CBK Treasury Bills" ? 10 : sourceName === "CBK Treasury Bonds" ? 11 : 2, sourceName === "CBK key rates and FX" ? 15 : sourceName === "CBK Treasury Bills" ? 30 : 0, 0, 0);
  return next;
}

export async function runScheduledSource(sourceName: string) {
  const attemptedAt = new Date();
  if (sourceName === "CBK key rates and FX" || sourceName === "CBK Treasury Bills") {
    let batch = await fetchCbkBatch();
    const isFxRun = sourceName === "CBK key rates and FX";

    // The CBK Bills & Bonds landing page can serve a stale first page of the
    // historical table. When that happens, use the dated official auction PDF,
    // which carries the accepted-bid weighted averages for all three tenors.
    if (!isFxRun && batch.treasuryBills.filter((row) => row.validationStatus === "VALID").length !== 3) {
      const pdfBatch = await fetchTreasuryBillResultDocuments({ maxDocuments: 12 });
      const now = Date.now();
      const freshRows = pdfBatch.records.filter((row) => {
        const age = now - row.issueDate.getTime();
        return row.validationStatus === "VALID" && age >= -24 * 60 * 60 * 1000 && age <= 14 * 24 * 60 * 60 * 1000;
      });
      const latestByTenor = new Map(freshRows.map((row) => [row.tenorDays, row] as const));
      const billRows = [91, 182, 364].map((tenor) => latestByTenor.get(tenor)).filter((row) => row !== undefined);

      if (billRows.length === 3) {
        const documentUrl = billRows[0]!.sourceUrl;
        const billObservations = billRows.map((row) => ({
          tenorDays: row.tenorDays, issueDate: row.issueDate, weightedAverageRate: row.weightedAverageRate,
          sourceUrl: row.sourceUrl, rawValue: row.rawValue, validationStatus: row.validationStatus,
        }));
        const curveObservations = billObservations.map((row) => ({
          tenor: String(row.tenorDays) + "D", maturityYears: row.tenorDays / 365, yieldRate: row.weightedAverageRate,
          sourceUrl: row.sourceUrl, observationDate: row.issueDate, rawValue: row.rawValue, validationStatus: row.validationStatus,
        }));
        batch = {
          ...batch, treasuryBills: billObservations, yieldCurve: curveObservations,
          sources: batch.sources.map((source) => source.name === "CBK Treasury Bills" || source.name === "CBK yield curve observations"
            ? { name: source.name, sourceType: "official CBK auction-results PDF", endpoint: documentUrl, status: "CURRENT" as const }
            : source),
        };
      } else {
        const diagnostic = "Official PDF fallback found " + pdfBatch.links.length + " candidate documents, parsed " + pdfBatch.records.length + " fresh valid rows, and recorded " + pdfBatch.errors.length + " lookup/parse issues.";
        batch = {
          ...batch,
          sources: batch.sources.map((source) => source.name === "CBK Treasury Bills"
            ? { ...source, status: "ERROR" as const, lastError: (source.lastError ?? "No fresh official CBK Treasury Bill observations.") + " " + diagnostic }
            : source),
        };
      }
    }

    const scopedBatch = {
      ...batch,
      marketRates: isFxRun ? batch.marketRates : [],
      fxRates: isFxRun ? batch.fxRates : [],
      treasuryBills: isFxRun ? [] : batch.treasuryBills,
      yieldCurve: isFxRun ? [] : batch.yieldCurve,
      sources: batch.sources.filter((source) =>
        isFxRun
          ? source.name === "CBK key rates and FX"
          : source.name === "CBK Treasury Bills" || source.name === "CBK yield curve observations"
      ),
    };
    const persistence = await persistCbkBatch(scopedBatch);
    const failedSources = scopedBatch.sources.filter((source) => source.status === "ERROR");
    const status = failedSources.length ? "ERROR" : persistence.rejected ? "STALE" : "CURRENT";
    return { status, sourceName, persistence, failedSources, retrievedAt: batch.retrievedAt.toISOString() };
  }
  if (sourceName === "CBK Treasury Bonds") {
    const batch = await fetchTreasuryBondDocuments({ maxDocuments: 8 });
    const persistence = await persistTreasuryBondBatch(batch.records, { retrievedAt: batch.retrievedAt, errors: batch.errors });
    return { status: persistence.status, sourceName, persistence, retrievedAt: batch.retrievedAt.toISOString() };
  }
  if (sourceName === "Historical market database") {
    const [fxCsv, billsHtml] = await Promise.all([fetchWithRetry(CBK_URLS.historicalFxCsv), fetchWithRetry(CBK_URLS.treasuryBillAverageRates)]);
    const fx = parseHistoricalFxCsv(fxCsv, CBK_URLS.historicalFxCsv, { limit: 10000 });
    const bills = parseHistoricalTreasuryBillHtml(billsHtml, CBK_URLS.treasuryBillAverageRates, { limit: 5000 });
    const fxPersistence = await persistHistoricalObservations(fx.rows, { sourceName: "Historical market database", endpoint: CBK_URLS.historicalFxCsv, expectedFrequency: "DAILY", retrievedAt: fx.retrievedAt, rejected: fx.rejected.length, backfillProgress: 25 });
    const billPersistence = await persistHistoricalObservations(bills.rows, { sourceName: "Historical T-Bill database", endpoint: CBK_URLS.treasuryBillAverageRates, expectedFrequency: "AUCTION", retrievedAt: bills.retrievedAt, rejected: bills.rejected.length, backfillProgress: 100 });
    const status = fx.rows.length > 0 && bills.rows.length > 0 ? "CURRENT" : "ERROR";
    return { status, sourceName, fx: fxPersistence, bills: billPersistence, parsed: { fx: fx.rows.length, treasuryBills: bills.rows.length }, retrievedAt: attemptedAt.toISOString() };
  }
  throw new Error(`Unknown ingestion source: ${sourceName}`);
}

export async function scheduledCbkIngestionHandler(req: Request, res: Response) {
  try {
    const suppliedSecret = req.get("x-fintel-cron-secret") ?? "";
    const configuredSecret = process.env.CBK_CRON_SECRET ?? "";
    const requestedSource =
      typeof req.query.source === "string" ? req.query.source : "";

    if (await isTrustedGitHubActionsRun(req)) {
      const allowedSources = new Set<string>(INGESTION_SCHEDULES.map((schedule) => schedule.sourceName));
      if (!requestedSource || !allowedSources.has(requestedSource)) {
        return res.status(400).json({ status: "ERROR", error: "source-required-or-unsupported" });
      }

      const result = await runScheduledSource(requestedSource);
      return res.json({
        ok: true,
        scheduler: "github-actions-oidc",
        source: requestedSource,
        ...result,
      });
    }

    if (suppliedSecret && configuredSecret) {
      const supplied = Buffer.from(suppliedSecret);
      const configured = Buffer.from(configuredSecret);

      const valid =
        supplied.length === configured.length &&
        timingSafeEqual(supplied, configured);

      if (!valid) {
        return res.status(403).json({
          status: "ERROR",
          error: "invalid-cron-secret",
        });
      }

      if (!requestedSource) {
        return res.status(400).json({
          status: "ERROR",
          error: "source-required",
        });
      }

      const result = await runScheduledSource(requestedSource);

      return res.json({
        ok: true,
        scheduler: "external-cron",
        source: requestedSource,
        ...result,
      });
    }

    const user = await sdk.authenticateRequest(req);

    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({
        status: "ERROR",
        error: "cron-only",
      });
    }

    const source = await getDataSourceByTaskUid(user.taskUid);

    if (!source) {
      return res.json({
        ok: true,
        skipped: "orphan",
      });
    }

    const result = await runScheduledSource(source.name);

    return res.json({
      ok: true,
      taskUid: user.taskUid,
      ...result,
    });

  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      error:
        error instanceof Error
          ? error.message
          : "Scheduled ingestion failed",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
}

export async function ensureSourceDefinitions() {
  const now = new Date();
  for (const schedule of INGESTION_SCHEDULES) {
    try { await upsertDataSource({ name: schedule.sourceName, sourceType: "CBK official connector", endpoint: schedule.sourceName === "CBK Treasury Bonds" ? CBK_URLS.treasuryBonds : schedule.sourceName === "CBK Treasury Bills" ? CBK_URLS.treasuryBillAverageRates : CBK_URLS.forex, status: "DATA REQUIRED", attemptedAt: now, successfulAt: null, recordCount: 0, expectedFrequency: schedule.frequency, nextScheduledAt: nextScheduledAt(schedule.sourceName, now), scheduleEnabled: process.env.CBK_SCHEDULER_ENABLED === "true", scheduleCronTaskUid: process.env[`CBK_TASK_UID_${schedule.sourceName.replace(/[^A-Z0-9]+/gi, "_").toUpperCase()}`] ?? null }); }
    catch (error) { console.warn(`[Scheduler] Could not initialize ${schedule.sourceName}:`, error); }
  }
  return INGESTION_SCHEDULES;
}

