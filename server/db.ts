import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, auditLogs, dataSources, fxRates, historicalPrices, ingestionRuns, instruments, marketData, portfolios, portfolioPositions, researchDocuments, researchMessages, researchSessions, riskResults, treasuryBills, treasuryBonds, users, yieldCurve } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { CbkBatch } from "./ingestion/cbk";
import type { BondObservation, HistoricalObservation } from "./ingestion/phase2";
import { isDuplicateKeyError } from "./dataIntegrity";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = values[field]; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function upsertDataSource(input: { name: string; sourceType: string; endpoint: string; status: "READY" | "LIVE" | "CURRENT" | "STALE" | "BACKFILLING" | "DATA REQUIRED" | "ERROR"; attemptedAt: Date; successfulAt?: Date | null; recordCount: number; recordsRejected?: number; recordsInserted?: number; duplicates?: number; lastRunDurationMs?: number; nextScheduledAt?: Date | null; latestObservation?: Date | null; expectedFrequency?: string; progressPercent?: number; scheduleCronTaskUid?: string | null; scheduleEnabled?: boolean; lastError?: string | null; quality?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(dataSources).where(eq(dataSources.name, input.name)).limit(1);
  const preserveValidated = input.status === "DATA REQUIRED" && Boolean(existing[0]?.recordCount) && existing[0]?.status === "CURRENT";
  const effectiveStatus = preserveValidated ? "CURRENT" : input.status;
  const values = { name: input.name, sourceType: input.sourceType, endpoint: input.endpoint, status: effectiveStatus, expectedFrequency: input.expectedFrequency ?? existing[0]?.expectedFrequency ?? null, latestObservation: input.latestObservation ?? existing[0]?.latestObservation ?? null, lastUpdated: input.successfulAt ?? existing[0]?.lastUpdated ?? null, lastAttemptedAt: input.attemptedAt, lastSuccessfulUpdate: input.successfulAt ?? existing[0]?.lastSuccessfulUpdate ?? null, nextScheduledAt: input.nextScheduledAt ?? existing[0]?.nextScheduledAt ?? null, recordCount: preserveValidated ? existing[0]?.recordCount ?? input.recordCount : input.recordCount, recordsRejected: input.recordsRejected ?? (preserveValidated ? existing[0]?.recordsRejected ?? 0 : 0), recordsInserted: input.recordsInserted ?? existing[0]?.recordsInserted ?? 0, duplicates: input.duplicates ?? existing[0]?.duplicates ?? 0, lastRunDurationMs: input.lastRunDurationMs ?? existing[0]?.lastRunDurationMs ?? null, progressPercent: String(input.progressPercent ?? (preserveValidated ? existing[0]?.progressPercent ?? 0 : 0)), scheduleCronTaskUid: input.scheduleCronTaskUid ?? existing[0]?.scheduleCronTaskUid ?? null, scheduleEnabled: input.scheduleEnabled ?? existing[0]?.scheduleEnabled ?? false, lastError: input.lastError ?? (preserveValidated ? existing[0]?.lastError ?? null : null), quality: input.quality ?? (["CURRENT", "LIVE"].includes(effectiveStatus) ? "VALIDATED" : "UNKNOWN") };
  if (existing[0]) {
    await db.update(dataSources).set(values).where(eq(dataSources.id, existing[0].id));
    return existing[0].id;
  }
  const inserted = await db.insert(dataSources).values(values);
  const insertId = Number((inserted as any).insertId ?? 0);
  if (insertId) return insertId;
  const created = await db.select({ id: dataSources.id }).from(dataSources).where(eq(dataSources.name, input.name)).limit(1);
  return created[0]?.id ?? 0;
}

async function hasMarketDuplicate(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, instrument: string, observationDate: Date) {
  const rows = await db.select({ id: marketData.id }).from(marketData).where(and(eq(marketData.instrument, instrument), eq(marketData.observationDate, observationDate))).limit(1);
  return Boolean(rows[0]);
}

async function hasFxDuplicate(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, pair: string, observationDate: Date) {
  const rows = await db.select({ id: fxRates.id }).from(fxRates).where(and(eq(fxRates.pair, pair), eq(fxRates.observationDate, observationDate))).limit(1);
  return Boolean(rows[0]);
}

async function hasBillDuplicate(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tenorDays: number, auctionDate: Date) {
  const rows = await db.select({ id: treasuryBills.id }).from(treasuryBills).where(and(eq(treasuryBills.tenorDays, tenorDays), eq(treasuryBills.auctionDate, auctionDate))).limit(1);
  return Boolean(rows[0]);
}

export async function persistCbkBatch(batch: CbkBatch) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const retrievalTimestamp = batch.retrievedAt;
  const sourceIds = new Map<string, number>();
  const sourceRows = (name: string) => name === "CBK key rates and FX" ? [...batch.marketRates, ...batch.fxRates] : name === "CBK Treasury Bills" ? batch.treasuryBills : name === "CBK yield curve observations" ? batch.yieldCurve : [];
  const sourceFrequency = (name: string) => name === "CBK key rates and FX" ? "DAILY" : name === "CBK Treasury Bills" || name === "CBK yield curve observations" ? "AUCTION" : "AS_PUBLISHED";
  const sourceRejected = (name: string) => sourceRows(name).filter((row) => row.validationStatus !== "VALID").length;
  const sourceLatest = (name: string) => sourceRows(name).map((row) => { const value = row as { observationDate?: Date; auctionDate?: Date }; return value.observationDate ?? value.auctionDate ?? null; }).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
  for (const source of batch.sources) {
    if (source.status === "DATA REQUIRED" && sourceRows(source.name).length === 0) continue;
    sourceIds.set(source.name, await upsertDataSource({ name: source.name, sourceType: source.sourceType, endpoint: source.endpoint, status: source.status, attemptedAt: retrievalTimestamp, successfulAt: source.status === "CURRENT" ? retrievalTimestamp : null, recordCount: sourceRows(source.name).length, recordsRejected: sourceRejected(source.name), latestObservation: sourceLatest(source.name), expectedFrequency: sourceFrequency(source.name), lastError: source.lastError ?? null }));
  }
  let inserted = 0;
  let duplicates = 0;
  let rejected = 0;
  const cbkSourceId = sourceIds.get("CBK key rates and FX") || null;
  for (const row of batch.marketRates) {
    if (row.validationStatus !== "VALID") { rejected++; continue; }
    if (await hasMarketDuplicate(db, row.instrument, row.observationDate)) { duplicates++; continue; }
    try {
      await db.insert(marketData).values({ instrument: row.instrument, assetClass: "MONEY_MARKET", value: String(row.value), unit: row.unit, sourceId: cbkSourceId, asOf: row.observationDate, quality: "VALIDATED", observationDate: row.observationDate, publicationTimestamp: row.publicationTimestamp, retrievalTimestamp, frequency: row.frequency, currency: row.currency, sourceUrl: row.sourceUrl, ingestionStatus: "CURRENT", rawValue: row.rawValue } as any);
      inserted++;
    } catch (error) {
      if (isDuplicateKeyError(error)) { duplicates++; continue; }
      throw error;
    }
  }
  for (const row of batch.fxRates) {
    if (row.validationStatus !== "VALID") { rejected++; continue; }
    if (await hasFxDuplicate(db, row.pair, row.observationDate)) { duplicates++; continue; }
    try {
      await db.insert(fxRates).values({ pair: row.pair, rate: String(row.value), asOf: row.observationDate, sourceId: cbkSourceId, quality: "VALIDATED", observationDate: row.observationDate, publicationTimestamp: row.publicationTimestamp, retrievalTimestamp, frequency: row.frequency, currency: row.currency, sourceUrl: row.sourceUrl, ingestionStatus: "CURRENT", rawValue: row.rawValue } as any);
      inserted++;
    } catch (error) {
      if (isDuplicateKeyError(error)) { duplicates++; continue; }
      throw error;
    }
  }
  const billsSourceId = sourceIds.get("CBK Treasury Bills") || null;
  for (const row of batch.treasuryBills) {
    if (row.validationStatus !== "VALID") { rejected++; continue; }
    if (await hasBillDuplicate(db, row.tenorDays, row.auctionDate)) { duplicates++; continue; }
    try {
      await db.insert(treasuryBills).values({ tenorDays: row.tenorDays, auctionDate: row.auctionDate, weightedAverageRate: String(row.weightedAverageRate), sourceId: billsSourceId, quality: "VALIDATED", observationDate: row.auctionDate, publicationTimestamp: retrievalTimestamp, retrievalTimestamp, frequency: "AUCTION", currency: "KES", sourceUrl: row.sourceUrl, ingestionStatus: "CURRENT", rawValue: row.rawValue } as any);
      inserted++;
    } catch (error) {
      if (isDuplicateKeyError(error)) { duplicates++; continue; }
      throw error;
    }
  }
  const curveSourceId = sourceIds.get("CBK yield curve observations") || billsSourceId;
  for (const row of batch.yieldCurve) {
    if (row.validationStatus !== "VALID") { rejected++; continue; }
    const existing = await db.select({ id: yieldCurve.id }).from(yieldCurve).where(and(eq(yieldCurve.tenor, row.tenor), eq(yieldCurve.curveDate, row.observationDate))).limit(1);
    if (existing[0]) { duplicates++; continue; }
    try {
      await db.insert(yieldCurve).values({ tenor: row.tenor, maturityYears: String(row.maturityYears), yieldRate: String(row.yieldRate), curveDate: row.observationDate, sourceId: curveSourceId, quality: "OBSERVED", observationDate: row.observationDate, publicationTimestamp: retrievalTimestamp, retrievalTimestamp, frequency: "AUCTION", currency: "KES", sourceUrl: row.sourceUrl, ingestionStatus: "CURRENT", rawValue: row.rawValue } as any);
      inserted++;
    } catch (error) {
      if (isDuplicateKeyError(error)) { duplicates++; continue; }
      throw error;
    }
  }
  for (const source of batch.sources) {
    if (source.status === "DATA REQUIRED" && sourceRows(source.name).length === 0) continue;
    await upsertDataSource({ name: source.name, sourceType: source.sourceType, endpoint: source.endpoint, status: source.status, attemptedAt: retrievalTimestamp, successfulAt: source.status === "CURRENT" ? retrievalTimestamp : null, recordCount: sourceRows(source.name).length, recordsRejected: sourceRejected(source.name), latestObservation: sourceLatest(source.name), expectedFrequency: sourceFrequency(source.name), lastError: source.lastError ?? null });
  }
  return { inserted, duplicates, rejected, retrievedAt: retrievalTimestamp.toISOString() };
}

export async function getLatestMarketData() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(marketData).orderBy(desc(marketData.observationDate)).limit(100);
}

export async function getLatestFxRates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fxRates).orderBy(desc(fxRates.observationDate)).limit(100);
}

export async function getLatestTreasuryBills() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(treasuryBills).orderBy(desc(treasuryBills.observationDate)).limit(100);
}

export async function getLatestTreasuryBonds() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(treasuryBonds).orderBy(desc(treasuryBonds.observationDate)).limit(100);
}

export async function getLatestYieldCurve() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(yieldCurve).orderBy(desc(yieldCurve.observationDate)).limit(100);
}

export async function getHistoricalPrices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(historicalPrices).orderBy(desc(historicalPrices.observationDate)).limit(250);
}

export async function getHistoricalPriceSeries(instrument: string, limit = 5000) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(historicalPrices).where(eq(historicalPrices.instrument, instrument)).orderBy(asc(historicalPrices.observationDate)).limit(limit);
}

export async function getRecentIngestionRuns(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: ingestionRuns.id, sourceId: ingestionRuns.sourceId, status: ingestionRuns.status,
    attemptedAt: ingestionRuns.attemptedAt, completedAt: ingestionRuns.completedAt,
    observationStart: ingestionRuns.observationStart, observationEnd: ingestionRuns.observationEnd,
    recordsImported: ingestionRuns.recordsImported, recordsRejected: ingestionRuns.recordsRejected,
    duplicates: ingestionRuns.duplicates, error: ingestionRuns.error, metadata: ingestionRuns.metadata,
  }).from(ingestionRuns).orderBy(desc(ingestionRuns.attemptedAt)).limit(limit);
}

export async function getDataHealth() {
  const db = await getDb();
  if (!db) return { database: { status: "BACKEND OFFLINE", lastSuccessfulUpdate: null, lastAttemptedUpdate: null, recordCount: 0, error: "Database unavailable" } };
  const rows = await db.select().from(dataSources);
  const map = new Map(rows.map((row) => [row.name, row]));
  const required = ["CBK key rates and FX", "CBK Treasury Bills", "CBK Treasury Bonds", "CBK yield curve observations", "Historical market database", "Historical T-Bill database"];
  const sourceStatuses = rows.map((row) => row.status);
  const databaseStatus = sourceStatuses.some((status) => status === "ERROR") ? "ERROR" : sourceStatuses.some((status) => status === "CURRENT" || status === "LIVE") ? "CURRENT" : "DATA REQUIRED";
  const latestSuccessful = rows.map((row) => row.lastSuccessfulUpdate).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
  const latestAttempted = rows.map((row) => row.lastAttemptedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
  return { database: { status: databaseStatus, lastSuccessfulUpdate: latestSuccessful, lastAttemptedUpdate: latestAttempted, recordCount: rows.reduce((sum, row) => sum + (row.recordCount ?? 0), 0), error: rows.find((row) => row.lastError)?.lastError ?? null }, sources: required.map((name) => { const row = map.get(name); return { name, status: row?.status ?? "DATA REQUIRED", lastSuccessfulUpdate: row?.lastSuccessfulUpdate ?? null, lastAttemptedUpdate: row?.lastAttemptedAt ?? null, nextScheduledAt: row?.nextScheduledAt ?? null, latestObservation: row?.latestObservation ?? null, expectedFrequency: row?.expectedFrequency ?? "DATA REQUIRED", recordCount: row?.recordCount ?? 0, recordsInserted: row?.recordsInserted ?? 0, duplicates: row?.duplicates ?? 0, recordsRejected: row?.recordsRejected ?? 0, lastRunDurationMs: row?.lastRunDurationMs ?? null, progressPercent: row?.progressPercent ?? "0", scheduleEnabled: row?.scheduleEnabled ?? false, error: row?.lastError ?? null, sourceUrl: row?.endpoint ?? null }; }) };
}

export async function getLatestPortfolioPositions(ownerUserId?: number) {
  const db = await getDb();
  if (!db) return { status: "BACKEND OFFLINE" as const, positions: [] };
  const portfolio = (ownerUserId === undefined ? await db.select().from(portfolios).orderBy(desc(portfolios.createdAt)).limit(1) : await db.select().from(portfolios).where(eq(portfolios.ownerUserId, ownerUserId)).orderBy(desc(portfolios.createdAt)).limit(1))[0];
  if (!portfolio) return { status: "NO PORTFOLIO / DATA REQUIRED" as const, positions: [] };
  const positions = await db.select().from(portfolioPositions).where(eq(portfolioPositions.portfolioId, portfolio.id));
  if (!positions.length) return { status: "NO PORTFOLIO / DATA REQUIRED" as const, portfolio, positions: [] };
  return { status: "CURRENT" as const, portfolio, positions };
}


const decimalValue = (value: number | null, scale: number) => value === null || !Number.isFinite(value) ? null : value.toFixed(scale);

export async function persistTreasuryBondBatch(records: BondObservation[], options: { retrievedAt: Date; errors?: Array<{ url: string; error: string }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const attemptedAt = options.retrievedAt;
  const sourceId = await upsertDataSource({ name: "CBK Treasury Bonds", sourceType: "official PDF result documents", endpoint: "https://www.centralbank.go.ke/bills-bonds/treasury-bonds/", status: records.length ? "CURRENT" : "ERROR", attemptedAt, successfulAt: records.length ? attemptedAt : null, recordCount: records.length, recordsRejected: records.filter((row) => row.validationStatus !== "VALID").length, latestObservation: records.map((row) => row.observationDate).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null, expectedFrequency: "AUCTION", lastError: options.errors?.length ? options.errors.map((item) => item.error).join("; ") : null });
  let inserted = 0;
  let duplicates = 0;
  let rejected = 0;
  for (const row of records) {
    if (row.validationStatus !== "VALID") { rejected++; continue; }
    const duplicate = await db.select({ id: treasuryBonds.id }).from(treasuryBonds).where(eq(treasuryBonds.duplicateKey, row.duplicateKey)).limit(1);
    if (duplicate[0]) { duplicates++; continue; }
    try {
      await db.insert(treasuryBonds).values({
        securityCode: row.securityCode, isin: row.isin, auctionDate: row.auctionDate, issueDate: row.issueDate, maturityDate: row.maturityDate, tenorYears: decimalValue(row.tenorYears, 4), couponRate: decimalValue(row.couponRate, 5), couponFrequency: row.couponFrequency, pricePer100: decimalValue(row.pricePer100, 6), yieldToMaturity: decimalValue(row.yieldToMaturity, 5), weightedAverageYield: decimalValue(row.weightedAverageYield, 5), cutOffYield: decimalValue(row.cutOffYield, 5), faceValueKes: decimalValue(row.faceValueKes, 2), amountOfferedKes: decimalValue(row.amountOfferedKes, 2), bidsReceivedKes: decimalValue(row.bidsReceivedKes, 2), bidsAcceptedKes: decimalValue(row.bidsAcceptedKes, 2), amountAcceptedKes: decimalValue(row.amountAcceptedKes, 2), documentUrl: row.documentUrl, duplicateKey: row.duplicateKey, validationStatus: row.validationStatus, reviewReason: row.reviewReason, sourceId, quality: "VALIDATED", createdAt: attemptedAt, observationDate: row.observationDate, publicationTimestamp: attemptedAt, retrievalTimestamp: attemptedAt, frequency: row.frequency, currency: row.currency, sourceUrl: row.sourceUrl, ingestionStatus: "CURRENT", rawValue: row.rawValue,
      } as any);
      inserted++;
    } catch (error) {
      if (isDuplicateKeyError(error)) { duplicates++; continue; }
      throw error;
    }
  }
  await recordIngestionRun({ sourceId, status: inserted || duplicates ? "CURRENT" : "ERROR", attemptedAt, completedAt: new Date(), observationStart: records.map((row) => row.observationDate).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null, observationEnd: records.map((row) => row.observationDate).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null, recordsImported: inserted, recordsRejected: rejected, duplicates, error: options.errors?.length ? options.errors.map((item) => item.error).join("; ") : null, metadata: { documents: new Set(records.map((row) => row.documentUrl)).size } });
  return { inserted, duplicates, rejected, errors: options.errors ?? [], sourceId };
}

export async function persistHistoricalObservations(rows: HistoricalObservation[], options: { sourceName: string; endpoint: string; expectedFrequency: string; retrievedAt: Date; rejected?: number; backfillProgress?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const sourceStatus = rows.length ? ((options.backfillProgress ?? 0) >= 100 ? "CURRENT" : "BACKFILLING") : "DATA REQUIRED";
  const sourceId = await upsertDataSource({ name: options.sourceName, sourceType: "official historical dataset", endpoint: options.endpoint, status: sourceStatus, attemptedAt: options.retrievedAt, successfulAt: rows.length ? options.retrievedAt : null, recordCount: rows.length, recordsRejected: options.rejected ?? 0, latestObservation: rows.map((row) => row.observationDate).sort((a, b) => b.getTime() - a.getTime())[0] ?? null, expectedFrequency: options.expectedFrequency, progressPercent: options.backfillProgress ?? 0 });
  const grouped = new Map<string, HistoricalObservation[]>();
  for (const row of rows) { if (!grouped.has(row.instrument)) grouped.set(row.instrument, []); grouped.get(row.instrument)!.push(row); }
  let inserted = 0;
  let duplicates = 0;
  let rejected = options.rejected ?? 0;
  for (const [instrument, instrumentRows] of Array.from(grouped.entries())) {
    const existing = await db.select({ observationDate: historicalPrices.observationDate }).from(historicalPrices).where(eq(historicalPrices.instrument, instrument));
    const existingKeys = new Set(existing.map((row) => row.observationDate?.getTime()).filter((value): value is number => value !== undefined));
    const values: any[] = [];
    for (const row of instrumentRows) {
      if (existingKeys.has(row.observationDate.getTime())) { duplicates++; continue; }
      if (row.quality !== "VALIDATED") { rejected++; continue; }
      existingKeys.add(row.observationDate.getTime());
      values.push({ instrument: row.instrument, price: String(row.value), asOf: row.observationDate, sourceId, quality: row.quality, observationDate: row.observationDate, publicationTimestamp: null, retrievalTimestamp: row.retrievalTimestamp, frequency: row.frequency, currency: row.currency, sourceUrl: row.sourceUrl, ingestionStatus: "CURRENT", rawValue: row.rawValue });
    }
    for (let offset = 0; offset < values.length; offset += 500) {
      const chunk = values.slice(offset, offset + 500);
      if (!chunk.length) continue;
      try {
        await db.insert(historicalPrices).values(chunk);
        inserted += chunk.length;
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        for (const value of chunk) {
          try {
            await db.insert(historicalPrices).values(value);
            inserted++;
          } catch (rowError) {
            if (isDuplicateKeyError(rowError)) duplicates++;
            else throw rowError;
          }
        }
      }
    }
  }
  await recordIngestionRun({ sourceId, status: options.backfillProgress && options.backfillProgress < 100 ? "BACKFILLING" : "CURRENT", attemptedAt: options.retrievedAt, completedAt: new Date(), observationStart: rows.map((row) => row.observationDate).sort((a, b) => a.getTime() - b.getTime())[0] ?? null, observationEnd: rows.map((row) => row.observationDate).sort((a, b) => b.getTime() - a.getTime())[0] ?? null, recordsImported: inserted, recordsRejected: rejected, duplicates, metadata: { duplicates } });
  return { inserted, duplicates, rejected, sourceId };
}

export async function recordIngestionRun(input: { sourceId: number; status: "RUNNING" | "CURRENT" | "STALE" | "BACKFILLING" | "ERROR"; attemptedAt: Date; completedAt?: Date | null; observationStart?: Date | null; observationEnd?: Date | null; recordsImported?: number; recordsRejected?: number; duplicates?: number; error?: string | null; metadata?: unknown }) {
  const db = await getDb();
  if (!db || !input.sourceId) return null;
  await db.insert(ingestionRuns).values({ sourceId: input.sourceId, status: input.status, attemptedAt: input.attemptedAt, completedAt: input.completedAt ?? null, observationStart: input.observationStart ?? null, observationEnd: input.observationEnd ?? null, recordsImported: input.recordsImported ?? 0, recordsRejected: input.recordsRejected ?? 0, duplicates: input.duplicates ?? 0, error: input.error ?? null, metadata: input.metadata ?? null } as any);
  return true;
}

export async function getHistoricalCoverage() {
  const db = await getDb();
  if (!db) return { status: "BACKEND OFFLINE", instruments: [], totalRecords: 0, missingWeekdays: null };
  const rows = await db.select({
    instrument: historicalPrices.instrument,
    count: sql<number>`count(*)`,
    start: sql<Date>`min(${historicalPrices.observationDate})`,
    end: sql<Date>`max(${historicalPrices.observationDate})`,
  }).from(historicalPrices).where(eq(historicalPrices.quality, "VALIDATED")).groupBy(historicalPrices.instrument);
  const totalRecords = rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
  return {
    status: totalRecords ? "CURRENT" : "DATA REQUIRED",
    totalRecords,
    instruments: rows.map((row) => ({ instrument: row.instrument, count: Number(row.count ?? 0), start: row.start ? new Date(row.start).toISOString() : null, end: row.end ? new Date(row.end).toISOString() : null })),
    missingWeekdays: null,
  };
}

export async function getDataSourceByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(dataSources).where(eq(dataSources.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}


export async function upsertInstrument(input: { symbol: string; name: string; assetClass: string; currency?: string | null; securityCode?: string | null; isin?: string | null; sourceId?: number | null; metadata?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(instruments).where(eq(instruments.symbol, input.symbol)).limit(1);
  const values = { symbol: input.symbol, name: input.name, assetClass: input.assetClass, currency: input.currency ?? null, securityCode: input.securityCode ?? null, isin: input.isin ?? null, sourceId: input.sourceId ?? null, metadata: input.metadata ?? null };
  if (existing[0]) {
    await db.update(instruments).set(values as any).where(eq(instruments.id, existing[0].id));
    return { ...existing[0], ...values, id: existing[0].id };
  }
  const result = await db.insert(instruments).values(values as any);
  const id = Number((result as any).insertId ?? 0);
  const created = id ? await db.select().from(instruments).where(eq(instruments.id, id)).limit(1) : [];
  return created[0] ?? { ...values, id };
}

export async function listPortfolios(ownerUserId?: number) {
  const db = await getDb();
  if (!db) return { status: "BACKEND OFFLINE" as const, portfolios: [] };
  const rows = ownerUserId ? await db.select().from(portfolios).where(eq(portfolios.ownerUserId, ownerUserId)).orderBy(desc(portfolios.updatedAt)) : await db.select().from(portfolios).orderBy(desc(portfolios.updatedAt));
  return { status: rows.length ? "CURRENT" as const : "DATA REQUIRED" as const, portfolios: rows };
}

export async function createPortfolioRecord(input: { ownerUserId: number; name: string; description?: string | null; baseCurrency?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(portfolios).values({ ownerUserId: input.ownerUserId, name: input.name, description: input.description ?? null, baseCurrency: input.baseCurrency ?? "KES", status: "ACTIVE" });
  const id = Number((result as any).insertId ?? 0);
  const created = id ? await db.select().from(portfolios).where(eq(portfolios.id, id)).limit(1) : [];
  return created[0];
}

export async function addPortfolioPositionRecord(input: { portfolioId: number; instrumentId?: number | null; instrument: string; assetClass: string; quantity?: number | null; marketValueKes?: number | null; priceKes?: number | null; currency?: string; positionDate?: Date | null; duration?: number | null; volatility?: number | null; metadata?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(portfolioPositions).values({ portfolioId: input.portfolioId, instrumentId: input.instrumentId ?? null, instrument: input.instrument, assetClass: input.assetClass, quantity: input.quantity?.toFixed(8) ?? null, marketValueKes: input.marketValueKes?.toFixed(2) ?? null, priceKes: input.priceKes?.toFixed(8) ?? null, currency: input.currency ?? "KES", positionDate: input.positionDate ?? new Date(), duration: input.duration?.toFixed(5) ?? null, volatility: input.volatility?.toFixed(5) ?? null, metadata: input.metadata ?? null } as any);
  const id = Number((result as any).insertId ?? 0);
  const created = id ? await db.select().from(portfolioPositions).where(eq(portfolioPositions.id, id)).limit(1) : [];
  return created[0];
}

export async function getPortfolioById(portfolioId: number, ownerUserId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).limit(1);
  const portfolio = rows[0];
  if (!portfolio || (ownerUserId !== undefined && portfolio.ownerUserId !== ownerUserId)) return undefined;
  const positions = await db.select().from(portfolioPositions).where(eq(portfolioPositions.portfolioId, portfolioId));
  return { portfolio, positions };
}

export async function resolvePortfolioHistoricalSeries(positions: Array<{ instrument: string; instrumentId?: number | null }>, limit = 5000) {
  const db = await getDb();
  if (!db) return { series: {}, missing: positions.map((position) => position.instrument), observations: 0 };
  const series: Record<string, Array<{ date: string; value: number }>> = {};
  const missing: string[] = [];
  let observations = 0;
  for (const position of positions) {
    let symbol = position.instrument;
    if (position.instrumentId) {
      const instrument = (await db.select({ symbol: instruments.symbol }).from(instruments).where(eq(instruments.id, position.instrumentId)).limit(1))[0];
      if (instrument?.symbol) symbol = instrument.symbol;
    }
    const rows = await getHistoricalPriceSeries(symbol, limit);
    const valid = rows.filter((row) => row.quality === "VALIDATED" && row.price !== null && (row.observationDate ?? row.asOf));
    if (valid.length < 2) {
      missing.push(position.instrument);
      continue;
    }
    series[position.instrument] = valid.map((row) => ({ date: (row.observationDate ?? row.asOf)!.toISOString(), value: Number(row.price) }));
    observations += valid.length;
  }
  return { series, missing, observations };
}

export async function getPortfolioRiskReadiness(portfolioId: number, ownerUserId?: number) {
  const portfolio = await getPortfolioById(portfolioId, ownerUserId);
  if (!portfolio) return { status: "DATA REQUIRED" as const, portfolioId, reasons: ["Portfolio not found or not accessible"], instruments: [] };
  if (!portfolio.positions.length) return { status: "DATA REQUIRED" as const, portfolioId, reasons: ["Portfolio contains no persisted positions"], instruments: [] };
  const history = await resolvePortfolioHistoricalSeries(portfolio.positions.map((row) => ({ instrument: row.instrument, instrumentId: row.instrumentId })), 5000);
  const reasons = history.missing.map((instrument) => `Validated historical observations are insufficient for ${instrument}`);
  const sufficient = history.missing.length === 0 && history.observations >= 2;
  return {
    status: sufficient ? "CURRENT" as const : "DATA REQUIRED" as const,
    portfolioId,
    reasons: sufficient ? [] : reasons.length ? reasons : ["At least two aligned validated observations are required"],
    instruments: portfolio.positions.map((position) => ({ instrument: position.instrument, instrumentId: position.instrumentId ?? null, historicalStatus: history.missing.includes(position.instrument) ? "DATA REQUIRED" : "CURRENT" })),
    observations: history.observations,
  };
}

export async function persistRiskResult(input: { portfolioId: number; method: string; confidence: number; horizonDays: number; varKes?: number | null; cvarKes?: number | null; stress?: unknown; lineage: unknown }) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(riskResults).values({ portfolioId: input.portfolioId, method: input.method, confidence: input.confidence.toFixed(4), horizonDays: input.horizonDays, varKes: input.varKes?.toFixed(2) ?? null, cvarKes: input.cvarKes?.toFixed(2) ?? null, stressJson: input.stress ?? null, lineageJson: input.lineage, calculatedAt: new Date() } as any);
  return true;
}

export async function writeAuditLog(input: { actorUserId?: number | null; action: string; resourceType: string; resourceId?: string | null; result: string; requestId?: string | null; metadata?: unknown }) {
  const db = await getDb();
  if (!db) return false;
  await db.insert(auditLogs).values({ actorUserId: input.actorUserId ?? null, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId ?? null, result: input.result, requestId: input.requestId ?? null, metadata: input.metadata ?? null });
  return true;
}

export async function getAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}


export async function createResearchSession(input: { ownerUserId: number; title: string; mode: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(researchSessions).values({ ownerUserId: input.ownerUserId, title: input.title, mode: input.mode, status: "CURRENT" });
  const id = Number((result as any).insertId ?? 0);
  return (await db.select().from(researchSessions).where(eq(researchSessions.id, id)).limit(1))[0] ?? null;
}

export async function listResearchSessions(ownerUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(researchSessions).where(eq(researchSessions.ownerUserId, ownerUserId)).orderBy(desc(researchSessions.updatedAt)).limit(limit);
}

export async function getResearchSession(sessionId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const session = (await db.select().from(researchSessions).where(and(eq(researchSessions.id, sessionId), eq(researchSessions.ownerUserId, ownerUserId))).limit(1))[0];
  if (!session) return null;
  const messages = await db.select().from(researchMessages).where(eq(researchMessages.sessionId, sessionId)).orderBy(asc(researchMessages.createdAt));
  return { session, messages };
}

export async function appendResearchMessage(input: { sessionId: number; role: "user" | "assistant" | "system"; content: string; evidence?: unknown; quantResults?: unknown; sources?: unknown; assumptions?: unknown; limitations?: unknown; status?: string; model?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(researchMessages).values({ sessionId: input.sessionId, role: input.role, content: input.content, evidenceJson: input.evidence ?? null, quantResultsJson: input.quantResults ?? null, sourcesJson: input.sources ?? null, assumptionsJson: input.assumptions ?? null, limitationsJson: input.limitations ?? null, status: input.status ?? "CURRENT", model: input.model ?? null });
  await db.update(researchSessions).set({ updatedAt: new Date(), status: (input.status ?? "CURRENT") as any }).where(eq(researchSessions.id, input.sessionId));
  return true;
}

export async function deleteResearchSession(sessionId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const owned = await db.select({ id: researchSessions.id }).from(researchSessions).where(and(eq(researchSessions.id, sessionId), eq(researchSessions.ownerUserId, ownerUserId))).limit(1);
  if (!owned[0]) return false;
  await db.delete(researchMessages).where(eq(researchMessages.sessionId, sessionId));
  await db.delete(researchSessions).where(and(eq(researchSessions.id, sessionId), eq(researchSessions.ownerUserId, ownerUserId)));
  return true;
}

export async function listResearchDocuments(ownerUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(researchDocuments).where(eq(researchDocuments.ownerUserId, ownerUserId)).orderBy(desc(researchDocuments.createdAt)).limit(limit);
}

export async function createResearchDocument(input: { ownerUserId: number; filename: string; title?: string; mimeType: string; contentHash: string; storageKey?: string; metadata?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(researchDocuments).values({ ownerUserId: input.ownerUserId, filename: input.filename, title: input.title ?? null, mimeType: input.mimeType, contentHash: input.contentHash, storageKey: input.storageKey ?? null, metadata: input.metadata ?? null, status: "READY" });
  const id = Number((result as any).insertId ?? 0);
  return (await db.select().from(researchDocuments).where(eq(researchDocuments.id, id)).limit(1))[0] ?? null;
}
