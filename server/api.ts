import type { Express, Request, Response } from "express";
import { z } from "zod";
import { derivativePayload, engineStatus, runEngine, sampleMarketFields, QuantEngineError } from "./quant_engine/client";
import { fetchCbkBatch, fetchWithRetry, CBK_URLS } from "./ingestion/cbk";
import { fetchTreasuryBondDocuments, parseHistoricalFxCsv, parseHistoricalTreasuryBillHtml } from "./ingestion/phase2";
import { getDataHealth, getRecentIngestionRuns, getHistoricalCoverage, getHistoricalPriceSeries, getLatestFxRates, getLatestMarketData, getLatestPortfolioPositions, getLatestTreasuryBills, getLatestTreasuryBonds, getLatestYieldCurve, persistCbkBatch, persistHistoricalObservations, persistTreasuryBondBatch } from "./db";
import { INGESTION_SCHEDULES } from "./scheduler";
import { sdk, type AuthenticatedUser } from "./_core/sdk";
import { hasPermission } from "./_core/permissions";
import { persistRiskResult, resolvePortfolioHistoricalSeries, getPortfolioById, getPortfolioRiskReadiness, writeAuditLog } from "./db";

const derivativeSchema = z.object({ model: z.enum(["black_scholes", "crr", "monte_carlo"]).default("black_scholes"), spot: z.number().positive(), strike: z.number().positive(), tenorYears: z.number().positive(), rate: z.number(), volatility: z.number().positive(), optionType: z.enum(["call", "put"]).default("call") });
const backfillSchema = z.object({ source: z.enum(["fx", "treasury_bills", "bonds"]), limit: z.number().int().positive().max(25000).optional(), maxDocuments: z.number().int().positive().max(25).optional() });
const errorResponse = (res: Response, error: unknown) => {
  if (error instanceof QuantEngineError) return res.status(error.code === "BACKEND OFFLINE" ? 503 : 422).json({ status: error.code, message: error.message });
  const message = error instanceof Error ? error.message : "Unknown API error";
  return res.status(message.includes("Database") ? 503 : 500).json({ status: message.includes("Database") ? "BACKEND OFFLINE" : "ERROR", message });
};
const sendAsync = async (res: Response, action: () => Promise<unknown> | unknown) => { try { return res.json(await action()); } catch (error) { return errorResponse(res, error); } };
const requirePermission = async (req: Request, res: Response, permission: string): Promise<AuthenticatedUser | null> => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!hasPermission(user.role, permission)) { await writeAuditLog({ actorUserId: user.id > 0 ? user.id : null, action: "authorization.denied", resourceType: req.path, result: "FORBIDDEN", requestId: String(res.getHeader("X-Request-ID") ?? "") }); res.status(403).json({ status: "FORBIDDEN", message: `Missing permission: ${permission}` }); return null; }
    return user;
  } catch { res.status(401).json({ status: "UNAUTHORIZED", message: "Authentication required" }); return null; }
};
const body = (req: Request) => derivativeSchema.parse(req.body);
const freshness = (date: Date | string | null | undefined, frequency = "AS_PUBLISHED") => {
  if (!date) return "DATA REQUIRED";
  const ageDays = (Date.now() - new Date(date).getTime()) / 86400000;
  if (frequency === "DAILY") return ageDays <= 2 ? "CURRENT" : "STALE";
  if (frequency === "AUCTION") return ageDays <= 14 ? "CURRENT" : "STALE";
  return ageDays <= 7 ? "CURRENT" : "STALE";
};
const noData = (source: string, fields: string[], sourceUrl: string) => ({ status: "DATA REQUIRED", source, sourceUrl, timestamp: null, fields, message: "Backend connection required or no validated observation has been persisted", values: null });

export function registerFinancialApi(app: Express) {
  app.get("/api/market/cbk", (_req, res) => sendAsync(res, async () => {
    const rows = await getLatestMarketData();
    if (!rows.length) return noData("Central Bank of Kenya", ["Central Bank Rate", "KESONIA", "publication date"], CBK_URLS.forex);
    return { status: freshness(rows[0].observationDate, rows[0].frequency ?? "AS_PUBLISHED"), source: "Central Bank of Kenya", sourceUrl: CBK_URLS.forex, observationDate: rows[0].observationDate, lastUpdated: rows[0].retrievalTimestamp, frequency: rows[0].frequency, observations: rows };
  }));
  app.get("/api/market/fx", (_req, res) => sendAsync(res, async () => {
    const rows = await getLatestFxRates();
    if (!rows.length) return noData("Central Bank of Kenya", ["USD/KES", "other CBK FX rates", "observation date"], CBK_URLS.forex);
    return { status: freshness(rows[0].observationDate, "DAILY"), source: "Central Bank of Kenya", sourceUrl: CBK_URLS.forex, observationDate: rows[0].observationDate, lastUpdated: rows[0].retrievalTimestamp, frequency: "DAILY", observations: rows };
  }));
  app.get("/api/market/treasury-bills", (_req, res) => sendAsync(res, async () => {
    const rows = await getLatestTreasuryBills();
    if (!rows.length) return noData("Central Bank of Kenya", ["91D", "182D", "364D", "auction date", "weighted average rate"], CBK_URLS.treasuryBills);
    return { status: freshness(rows[0].observationDate, "AUCTION"), source: "Central Bank of Kenya", sourceUrl: CBK_URLS.treasuryBills, observationDate: rows[0].observationDate, lastUpdated: rows[0].retrievalTimestamp, frequency: "AUCTION", observations: rows };
  }));
  app.get("/api/market/bonds", (_req, res) => sendAsync(res, async () => {
    const rows = await getLatestTreasuryBonds();
    return rows.length ? { status: freshness(rows[0].observationDate, "AUCTION"), source: "Central Bank of Kenya", sourceUrl: CBK_URLS.treasuryBonds, observationDate: rows[0].observationDate, lastUpdated: rows[0].retrievalTimestamp, frequency: "AUCTION", observations: rows } : noData("Central Bank of Kenya", ["security code", "ISIN", "coupon", "maturity", "yield to maturity", "auction amounts"], CBK_URLS.treasuryBonds);
  }));
  app.get("/api/yield-curve", (_req, res) => sendAsync(res, async () => {
    const rows = await getLatestYieldCurve();
    if (!rows.length) return noData("CBK observations / FINTEL database", ["91D", "182D", "364D", "bond yields"], CBK_URLS.financialMarkets);
    const ordered = [...rows].sort((a, b) => Number(a.maturityYears) - Number(b.maturityYears));
    if (ordered.length < 2) return { status: "DATA REQUIRED", source: "CBK observations / FINTEL database", sourceUrl: CBK_URLS.financialMarkets, observationDate: rows[0]?.observationDate ?? null, lastUpdated: rows[0]?.retrievalTimestamp ?? null, methodology: "Awaiting at least two validated observations", observedPoints: ordered, values: null };
    const values = runEngine("fit_yield_curve", { maturities: ordered.map((row) => Number(row.maturityYears)), yields: ordered.map((row) => Number(row.yieldRate)) });
    return { status: freshness(rows[0].observationDate, rows[0].frequency ?? "AUCTION"), source: "CBK observations / FINTEL database", sourceUrl: CBK_URLS.financialMarkets, observationDate: rows[0].observationDate, lastUpdated: rows[0].retrievalTimestamp, methodology: "CBK bill/bond observations with Python interpolation", observedPoints: ordered, values };
  }));
  app.post("/api/derivatives/price", (req, res) => sendAsync(res, async () => ({ status: "LIVE", source: "Local Python Quant Engine", timestamp: new Date().toISOString(), values: runEngine("derivative_pricing", derivativePayload(body(req))) })));
  app.post("/api/greeks", (req, res) => sendAsync(res, async () => ({ status: "LIVE", source: "Local Python Quant Engine", timestamp: new Date().toISOString(), values: runEngine("derivative_pricing", derivativePayload(body(req))) })));
  app.post("/api/monte-carlo", (req, res) => sendAsync(res, async () => ({ status: "LIVE", source: "Local Python Quant Engine", timestamp: new Date().toISOString(), values: runEngine("derivative_pricing", derivativePayload(body(req), "monte_carlo")) })));
  app.post("/api/risk/var", async (req, res) => { if (!await requirePermission(req, res, "risk.run")) return; return sendAsync(res, async () => {
    if (!Array.isArray(req.body?.positions) || !req.body.positions.length) return { status: "NO PORTFOLIO / DATA REQUIRED", source: "FINTEL portfolio database", values: null };
    const values = runEngine("portfolio_risk", req.body);
    return { status: "LIVE", source: "Local Python Quant Engine", timestamp: new Date().toISOString(), dataStatus: values.historical_status, values };
  }); });
  app.post("/api/risk/stress", async (req, res) => { if (!await requirePermission(req, res, "risk.run")) return; return sendAsync(res, async () => {
    if (!Array.isArray(req.body?.positions) || !req.body.positions.length) return { status: "NO PORTFOLIO / DATA REQUIRED", source: "FINTEL portfolio database", values: null };
    return { status: "LIVE", source: "Local Python Quant Engine", timestamp: new Date().toISOString(), values: runEngine("portfolio_risk", req.body) };
  }); });
  app.get("/api/portfolio", async (req, res) => { const user = await requirePermission(req, res, "portfolio.read"); if (!user) return; return sendAsync(res, async () => {
    const portfolio = await getLatestPortfolioPositions(user.id);
    if (portfolio.status !== "CURRENT") return portfolio;
    const positions = portfolio.positions.map((row) => ({ name: row.instrument, asset_class: row.assetClass, value_kes: Number(row.marketValueKes ?? 0), duration: Number(row.duration ?? 0), volatility: Number(row.volatility ?? 0) }));
    const history = await resolvePortfolioHistoricalSeries(portfolio.positions.map((row) => ({ instrument: row.instrument, instrumentId: row.instrumentId })), 5000);
    const values = runEngine("portfolio_risk", { positions, historical_series: history.series });
    await persistRiskResult({ portfolioId: portfolio.portfolio.id, method: values.historical_status === "CURRENT" ? "Historical VaR + Parametric VaR" : "Parametric VaR", confidence: values.confidence_level, horizonDays: values.horizon_days, varKes: values.parametric_var_kes, cvarKes: values.cvar_expected_shortfall_kes, stress: values.stress_scenarios, lineage: { portfolioId: portfolio.portfolio.id, observationsUsed: history.observations, missingInstruments: values.historical_missing_instruments, calculatedAt: new Date().toISOString() } });
    return { status: "LIVE", source: "FINTEL portfolio database + Local Python Quant Engine", portfolio: portfolio.portfolio, positions: portfolio.positions, dataStatus: values.historical_status, values };
  }); });
  app.get("/api/historical-market-data", (_req, res) => sendAsync(res, async () => {
    const rows = await getHistoricalCoverage();
    return rows.totalRecords ? { ...rows, source: "CBK official historical datasets", status: rows.status } : noData("FINTEL historical database", ["instrument", "value", "observation date"], "database://historical_prices");
  }));
  app.get("/api/historical/analytics", (req, res) => sendAsync(res, async () => {
    const instrument = typeof req.query.instrument === "string" ? req.query.instrument : "USD/KES";
    const rows = await getHistoricalPriceSeries(instrument, 5000);
    if (rows.length < 2) return { status: "INSUFFICIENT HISTORY", source: "FINTEL historical database", instrument, observations: rows.length, values: null, message: "At least two validated observed values are required; simulated history is not used." };
    const values = runEngine("historical_analytics", { prices: rows.map((row) => Number(row.price)), confidence_level: 0.95, rolling_window: 20 });
    return { status: "LIVE", source: "FINTEL historical database + Local Python Quant Engine", instrument, observations: rows.length, observationStart: rows[0].observationDate ?? rows[0].asOf, observationEnd: rows[rows.length - 1].observationDate ?? rows[rows.length - 1].asOf, values };
  }));
  app.get("/api/models", (_req, res) => sendAsync(res, async () => {
    const engine = engineStatus();
    const portfolio = await getLatestPortfolioPositions();
    const history = await getHistoricalCoverage();
    return { status: engine.status, source: "FINTEL model registry", timestamp: new Date().toISOString(), models: ["Yield Curve", "Bond Analytics", "Black-Scholes-Merton", "CRR Binomial", "Monte Carlo", "Greeks", "Portfolio VaR", "Expected Shortfall", "Drawdown", "Stress Testing", "Backtesting"].map((model) => ({ model, status: ["Backtesting", "Drawdown", "Expected Shortfall"].includes(model) ? (history.totalRecords >= 2 ? engine.status : "DATA REQUIRED") : model.startsWith("Portfolio") ? (portfolio.status === "CURRENT" ? engine.status : "DATA REQUIRED") : engine.status, inputRequirements: model.startsWith("Portfolio") ? "Persisted portfolio positions" : ["Backtesting", "Drawdown", "Expected Shortfall"].includes(model) ? "Validated historical observations" : "Validated market observations or analyst inputs", lastRun: null, outputStatus: engine.status })) };
  }));
  app.post("/api/market/refresh", async (req, res) => { if (!await requirePermission(req, res, "data.ingest")) return; return sendAsync(res, async () => {
    try {
      const batch = await fetchCbkBatch();
      const persistence = await persistCbkBatch(batch);
      return { status: persistence.rejected ? "STALE" : "CURRENT", retrievedAt: batch.retrievedAt.toISOString(), sources: batch.sources, persistence, bonds: batch.bonds, freshness: "CURRENT for successfully retrieved official pages" };
    } catch (error) {
      return { status: "ERROR", retrievedAt: new Date().toISOString(), sources: [{ name: "CBK official ingestion", status: "ERROR", endpoint: CBK_URLS.forex }], persistence: { inserted: 0, duplicates: 0, rejected: 0 }, error: error instanceof Error ? error.message : "CBK ingestion failed" };
    }
  }); });
  app.post("/api/market/backfill", async (req, res) => { if (!await requirePermission(req, res, "data.ingest")) return; return sendAsync(res, async () => {
    const input = backfillSchema.parse(req.body);
    if (input.source === "bonds") {
      const batch = await fetchTreasuryBondDocuments({ maxDocuments: input.maxDocuments ?? 8 });
      return { source: "CBK Treasury Bonds", status: batch.records.length ? "CURRENT" : "ERROR", documents: batch.links.length, parsedRecords: batch.records.length, persistence: await persistTreasuryBondBatch(batch.records, { retrievedAt: batch.retrievedAt, errors: batch.errors }), errors: batch.errors };
    }
    if (input.source === "fx") {
      const csv = await fetchWithRetry("https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv");
      const parsed = parseHistoricalFxCsv(csv, "https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv", { limit: input.limit ?? 10000 });
      return { source: "CBK FX history", status: "BACKFILLING", parsedRecords: parsed.rows.length, rejected: parsed.rejected.length, persistence: await persistHistoricalObservations(parsed.rows, { sourceName: "Historical market database", endpoint: "https://www.centralbank.go.ke/rates/forex-exchange-rates/", expectedFrequency: "DAILY", retrievedAt: parsed.retrievedAt, rejected: parsed.rejected.length, backfillProgress: 25 }) };
    }
    const html = await fetchWithRetry("https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/");
    const parsed = parseHistoricalTreasuryBillHtml(html, "https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/", { limit: input.limit ?? 5000 });
    return { source: "CBK Treasury Bill history", status: "CURRENT", parsedRecords: parsed.rows.length, rejected: parsed.rejected.length, persistence: await persistHistoricalObservations(parsed.rows, { sourceName: "Historical T-Bill database", endpoint: "https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/", expectedFrequency: "AUCTION", retrievedAt: parsed.retrievedAt, rejected: parsed.rejected.length, backfillProgress: 100 }) };
  }); });
  app.get("/api/data/health", (_req, res) => sendAsync(res, getDataHealth));
  app.get("/api/data/ingestion-runs", (_req, res) => sendAsync(res, () => getRecentIngestionRuns(50)));
  app.get("/api/portfolio/:portfolioId/risk-readiness", async (req, res) => {
    const user = await requirePermission(req, res, "risk.read");
    if (!user) return;
    const portfolioId = Number(req.params.portfolioId);
    if (!Number.isInteger(portfolioId) || portfolioId <= 0) return res.status(400).json({ status: "ERROR", message: "Invalid portfolioId" });
    return sendAsync(res, () => getPortfolioRiskReadiness(portfolioId, user.id));
  });
  app.get("/api/scheduler/status", (_req, res) => sendAsync(res, async () => ({ status: "DEPLOYMENT REQUIRED", activation: "Jobs are implemented but not registered until the production callback is deployed.", callbackPath: "/api/scheduled/cbk-ingestion", schedules: INGESTION_SCHEDULES })));
  app.get("/api/system/health", (_req, res) => sendAsync(res, async () => ({ status: "OK", service: "FINTEL", timestamp: new Date().toISOString() })));
  app.get("/api/system/status", (_req, res) => sendAsync(res, async () => {
    const health = await getDataHealth();
    const sources = health.sources ?? [];
    return { api: "LIVE", quantEngine: engineStatus(), ...health, sources, marketData: sources.find((source) => source.name === "CBK key rates and FX") ?? { status: "DATA REQUIRED" }, crm: { status: "DATA REQUIRED", source: "CRM connector", lastSuccessfulUpdate: null, lastAttemptedUpdate: null, recordCount: 0, error: null }, availableFields: sampleMarketFields };
  }));
}
