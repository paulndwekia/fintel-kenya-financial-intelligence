import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { CBK_URLS, fetchCbkBatch, fetchWithRetry } from "./ingestion/cbk";
import { fetchTreasuryBondDocuments, parseHistoricalFxCsv, parseHistoricalTreasuryBillHtml } from "./ingestion/phase2";
import { getDataSourceByTaskUid, persistCbkBatch, persistHistoricalObservations, persistTreasuryBondBatch, recordIngestionRun, upsertDataSource } from "./db";
import { sdk } from "./_core/sdk";

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
  next.setUTCHours(sourceName === "CBK key rates and FX" ? 6 : sourceName === "CBK Treasury Bills" ? 10 : sourceName === "CBK Treasury Bonds" ? 11 : 2, sourceName === "CBK Treasury Bills" ? 30 : 0, 0, 0);
  return next;
}

export async function runScheduledSource(sourceName: string) {
  const attemptedAt = new Date();
  if (sourceName === "CBK key rates and FX" || sourceName === "CBK Treasury Bills") {
    const batch = await fetchCbkBatch();
    const persistence = await persistCbkBatch(batch);
    return { status: persistence.rejected ? "STALE" : "CURRENT", sourceName, persistence, retrievedAt: batch.retrievedAt.toISOString() };
  }
  if (sourceName === "CBK Treasury Bonds") {
    const batch = await fetchTreasuryBondDocuments({ maxDocuments: 8 });
    const persistence = await persistTreasuryBondBatch(batch.records, { retrievedAt: batch.retrievedAt, errors: batch.errors });
    return { status: persistence.inserted || persistence.duplicates ? "CURRENT" : "ERROR", sourceName, persistence, retrievedAt: batch.retrievedAt.toISOString() };
  }
  if (sourceName === "Historical market database") {
    const [fxCsv, billsHtml] = await Promise.all([fetchWithRetry("https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv"), fetchWithRetry("https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/")]);
    const fx = parseHistoricalFxCsv(fxCsv, "https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv", { limit: 10000 });
    const bills = parseHistoricalTreasuryBillHtml(billsHtml, "https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/", { limit: 5000 });
    const fxPersistence = await persistHistoricalObservations(fx.rows, { sourceName: "Historical market database", endpoint: "https://www.centralbank.go.ke/rates/forex-exchange-rates/", expectedFrequency: "DAILY", retrievedAt: fx.retrievedAt, rejected: fx.rejected.length, backfillProgress: 25 });
    const billPersistence = await persistHistoricalObservations(bills.rows, { sourceName: "Historical T-Bill database", endpoint: "https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/", expectedFrequency: "AUCTION", retrievedAt: bills.retrievedAt, rejected: bills.rejected.length, backfillProgress: 100 });
    return { status: "CURRENT", sourceName, fx: fxPersistence, bills: billPersistence, retrievedAt: attemptedAt.toISOString() };
  }
  throw new Error(`Unknown ingestion source: ${sourceName}`);
}

export async function scheduledCbkIngestionHandler(req: Request, res: Response) {
  try {
    const suppliedSecret = req.get("x-fintel-cron-secret") ?? "";
    const configuredSecret = process.env.CBK_CRON_SECRET ?? "";
    const requestedSource =
      typeof req.query.source === "string" ? req.query.source : "";

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
        scheduler: "render",
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
    try { await upsertDataSource({ name: schedule.sourceName, sourceType: "CBK official connector", endpoint: schedule.sourceName === "CBK Treasury Bonds" ? CBK_URLS.treasuryBonds : schedule.sourceName === "CBK Treasury Bills" ? CBK_URLS.treasuryBills : CBK_URLS.forex, status: "DATA REQUIRED", attemptedAt: now, successfulAt: null, recordCount: 0, expectedFrequency: schedule.frequency, nextScheduledAt: nextScheduledAt(schedule.sourceName, now), scheduleEnabled: process.env.CBK_SCHEDULER_ENABLED === "true", scheduleCronTaskUid: process.env[`CBK_TASK_UID_${schedule.sourceName.replace(/[^A-Z0-9]+/gi, "_").toUpperCase()}`] ?? null }); }
    catch (error) { console.warn(`[Scheduler] Could not initialize ${schedule.sourceName}:`, error); }
  }
  return INGESTION_SCHEDULES;
}

