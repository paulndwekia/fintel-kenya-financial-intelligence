import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { permissionProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { derivativePayload, engineStatus, runEngine, unavailableSource } from "./quant_engine/client";
import { addPortfolioPositionRecord, createPortfolioRecord, getAuditLogs, getDataHealth, getHistoricalCoverage, getHistoricalPriceSeries, getLatestFxRates, getLatestMarketData, getLatestPortfolioPositions, getLatestTreasuryBills, getLatestTreasuryBonds, getLatestYieldCurve, getPortfolioById, listPortfolios, persistRiskResult, resolvePortfolioHistoricalSeries, writeAuditLog } from "./db";
import { hasPermission } from "./_core/permissions";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createResearchSession, deleteResearchSession, getResearchSession, listResearchSessions, researchMode, runResearch } from "./research";
import { getDefaultAIProvider, listAIProviders } from "./aiProviders";

const derivativeInput = z.object({ model: z.enum(["black_scholes", "crr", "monte_carlo"]).default("black_scholes"), spot: z.number().positive(), strike: z.number().positive(), tenorYears: z.number().positive(), rate: z.number(), volatility: z.number().positive(), optionType: z.enum(["call", "put"]).default("call") });
const portfolioInput = z.object({ name: z.string().trim().min(2).max(128), description: z.string().trim().max(1000).optional(), baseCurrency: z.string().trim().length(3).default("KES") });
const positionInput = z.object({ portfolioId: z.number().int().positive(), instrumentId: z.number().int().positive().optional(), instrument: z.string().trim().min(1).max(128), assetClass: z.string().trim().min(1).max(64), quantity: z.number().finite().optional(), marketValueKes: z.number().finite().nonnegative().optional(), priceKes: z.number().finite().nonnegative().optional(), currency: z.string().trim().length(3).default("KES"), duration: z.number().finite().nonnegative().optional(), volatility: z.number().finite().nonnegative().optional() });
const sampleMarket = async () => {
  const [market, fx, bills, bonds] = await Promise.all([getLatestMarketData(), getLatestFxRates(), getLatestTreasuryBills(), getLatestTreasuryBonds()]);
  const rows = [...market, ...fx, ...bills, ...bonds];
  const instruments = rows.length ? [
    ...market.map((row) => ({ label: row.instrument, value: row.value ?? "DATA REQUIRED", unit: row.unit ?? "", source: row.sourceUrl, observationDate: row.observationDate, retrievedDate: row.retrievalTimestamp, frequency: row.frequency, status: row.ingestionStatus ?? "CURRENT" })),
    ...fx.map((row) => ({ label: row.pair, value: row.rate ?? "DATA REQUIRED", unit: "KES", source: row.sourceUrl, observationDate: row.observationDate, retrievedDate: row.retrievalTimestamp, frequency: row.frequency, status: row.ingestionStatus ?? "CURRENT" })),
    ...bills.map((row) => ({ label: `${row.tenorDays}-Day T-Bill`, value: row.weightedAverageRate ?? "DATA REQUIRED", unit: "%", source: row.sourceUrl, observationDate: row.observationDate, retrievedDate: row.retrievalTimestamp, frequency: row.frequency, status: row.ingestionStatus ?? "CURRENT" })),
    ...bonds.map((row) => ({ label: row.securityCode, value: row.yieldToMaturity ?? "DATA REQUIRED", unit: "% YTM", source: row.sourceUrl, observationDate: row.observationDate, retrievedDate: row.retrievalTimestamp, frequency: row.frequency, status: row.ingestionStatus ?? "CURRENT" })),
  ] : ["CBK Rate", "USD / KES", "91-Day T-Bill", "182-Day T-Bill", "364-Day T-Bill", "10Y Kenya Bond"].map(label => ({ label, value: "DATA REQUIRED", unit: "", state: "pending", source: null, observationDate: null, retrievedDate: null, frequency: null, status: "DATA REQUIRED" }));
  return { source: "CBK / FINTEL database", status: rows.length ? "CURRENT" : "DATA REQUIRED", lastUpdated: rows[0]?.retrievalTimestamp ?? null, instruments };
};
const requiredFeed = (source: string, fields: string[]) => unavailableSource(source, fields);
const persistedCurve = async () => {
  const rows = await getLatestYieldCurve();
  if (!rows.length) return [];
  const ordered = [...rows].sort((a, b) => Number(a.maturityYears) - Number(b.maturityYears));
  if (ordered.length < 2) return [];
  return runEngine("fit_yield_curve", { maturities: ordered.map((row) => Number(row.maturityYears)), yields: ordered.map((row) => Number(row.yieldRate)) });
};
const persistedRisk = async (ownerUserId?: number) => {
  const portfolio = await getLatestPortfolioPositions(ownerUserId);
  if (portfolio.status !== "CURRENT") return null;
  const positions = portfolio.positions.map((row) => ({ name: row.instrument, asset_class: row.assetClass, value_kes: Number(row.marketValueKes ?? 0), duration: Number(row.duration ?? 0), volatility: Number(row.volatility ?? 0) }));
  const history = await resolvePortfolioHistoricalSeries(portfolio.positions.map((row) => ({ instrument: row.instrument, instrumentId: row.instrumentId })), 5000);
  const values = runEngine("portfolio_risk", { positions, historical_series: history.series });
  await persistRiskResult({ portfolioId: portfolio.portfolio.id, method: values.historical_status === "CURRENT" ? "Historical VaR + Parametric VaR" : "Parametric VaR", confidence: values.confidence_level, horizonDays: values.horizon_days, varKes: values.parametric_var_kes, cvarKes: values.cvar_expected_shortfall_kes, stress: values.stress_scenarios, lineage: { portfolioId: portfolio.portfolio.id, valuationDate: portfolio.portfolio.valuationDate, observationsUsed: history.observations, missingInstruments: values.historical_missing_instruments, methodology: values.historical_status === "CURRENT" ? "Instrument-aligned observed returns" : "Parametric position risk; historical data required", calculatedAt: new Date().toISOString() } });
  return { ...values, portfolioId: portfolio.portfolio.id, historical_observations_used: history.observations, historical_missing_instruments: values.historical_missing_instruments, data_status: values.historical_status === "CURRENT" ? "CURRENT" : "DATA REQUIRED" };
};

export const appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query(opts => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }) }),
  market: router({ snapshot: publicProcedure.query(sampleMarket), yieldCurve: publicProcedure.query(persistedCurve), refresh: publicProcedure.mutation(() => ({ status: "Use /api/market/refresh", message: "Refresh is handled by the CBK ingestion workflow." })) }),
  cbk: router({ snapshot: publicProcedure.query(sampleMarket) }),
  fx: router({ current: publicProcedure.query(async () => { const rows = await getLatestFxRates(); return { status: rows.length ? "CURRENT" : "DATA REQUIRED", source: "Central Bank of Kenya", observations: rows }; }) }),
  treasuryBills: router({ list: publicProcedure.query(async () => { const rows = await getLatestTreasuryBills(); return { status: rows.length ? "CURRENT" : "DATA REQUIRED", source: "Central Bank of Kenya", observations: rows }; }) }),
  bonds: router({ list: publicProcedure.query(async () => { const rows = await getLatestTreasuryBonds(); return { status: rows.length ? "CURRENT" : "DATA REQUIRED", source: "Central Bank of Kenya", observations: rows }; }) }),
  yieldCurve: router({ current: publicProcedure.query(persistedCurve), historical: publicProcedure.query(() => requiredFeed("Historical curve store", ["curve date", "tenor", "yield"])) }),
  derivatives: router({ price: publicProcedure.input(derivativeInput).query(({ input }) => runEngine("derivative_pricing", derivativePayload(input))) }),
  greeks: router({ calculate: publicProcedure.input(derivativeInput).query(({ input }) => runEngine("derivative_pricing", derivativePayload(input))) }),
  monteCarlo: router({ price: publicProcedure.input(derivativeInput).query(({ input }) => runEngine("derivative_pricing", derivativePayload(input, "monte_carlo"))) }),
  analytics: router({
    bond: publicProcedure.input(z.object({ faceValue: z.number(), couponRate: z.number(), ytm: z.number(), years: z.number() })).query(({ input }) => runEngine("bond_analytics", { face_value: input.faceValue, coupon_rate: input.couponRate, ytm: input.ytm, years_to_maturity: input.years })),
    derivative: publicProcedure.input(derivativeInput).query(({ input }) => runEngine("derivative_pricing", derivativePayload(input))),
    risk: permissionProcedure("risk.read").query(({ ctx }) => persistedRisk(ctx.user.id)),
    historical: publicProcedure.input(z.object({ instrument: z.string().min(1) })).query(async ({ input }) => { const rows = await getHistoricalPriceSeries(input.instrument, 5000); if (rows.length < 2) return { status: "INSUFFICIENT HISTORY", source: "FINTEL historical database", instrument: input.instrument, observations: rows.length, values: null }; return { status: "LIVE", source: "FINTEL historical database + Local Python Quant Engine", instrument: input.instrument, observations: rows.length, values: runEngine("historical_analytics", { prices: rows.map((row) => Number(row.price)), confidence_level: 0.95, rolling_window: 20 }) }; }),
  }),
  risk: router({ overview: permissionProcedure("risk.read").query(({ ctx }) => persistedRisk(ctx.user.id)), stress: publicProcedure.query(() => requiredFeed("Portfolio positions", ["scenario", "shock", "loss"])) }),
  portfolio: router({
    list: protectedProcedure.query(({ ctx }) => listPortfolios(ctx.user.id)),
    create: permissionProcedure("portfolio.write").input(portfolioInput).mutation(async ({ ctx, input }) => { const created = await createPortfolioRecord({ ownerUserId: ctx.user.id, ...input }); await writeAuditLog({ actorUserId: ctx.user.id, action: "portfolio.create", resourceType: "portfolio", resourceId: String(created?.id ?? ""), result: created ? "SUCCESS" : "ERROR" }); return created; }),
    addPosition: permissionProcedure("portfolio.write").input(positionInput).mutation(async ({ ctx, input }) => { const ownedPortfolio = await getPortfolioById(input.portfolioId, ctx.user.id); if (!ownedPortfolio) throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio not found for current user" }); const created = await addPortfolioPositionRecord(input); await writeAuditLog({ actorUserId: ctx.user.id, action: "portfolio.position.create", resourceType: "portfolio_position", resourceId: String(created?.id ?? ""), result: created ? "SUCCESS" : "ERROR", metadata: { portfolioId: input.portfolioId, instrument: input.instrument } }); return created; }),
    summary: permissionProcedure("portfolio.read").query(({ ctx }) => persistedRisk(ctx.user.id)),
    positions: permissionProcedure("portfolio.read").query(async ({ ctx }) => { const portfolio = await getLatestPortfolioPositions(ctx.user.id); return portfolio.status === "CURRENT" ? portfolio : requiredFeed("FINTEL portfolio database", ["instrument", "market value", "duration", "volatility"]); }),
    detail: permissionProcedure("portfolio.read").input(z.object({ portfolioId: z.number().int().positive() })).query(async ({ ctx, input }) => { const portfolio = await getPortfolioById(input.portfolioId, ctx.user.id); return portfolio ? { status: "CURRENT" as const, ...portfolio } : { status: "DATA REQUIRED" as const, portfolio: null, positions: [] }; }),
    riskReadiness: permissionProcedure("risk.read").input(z.object({ portfolioId: z.number().int().positive() })).query(({ ctx, input }) => getPortfolioRiskReadiness(input.portfolioId, ctx.user.id)),
  }),
  audit: router({ recent: permissionProcedure("admin.audit").query(() => getAuditLogs()) }),
  ai: router({ providers: publicProcedure.query(() => ({ providers: listAIProviders(), defaultProvider: getDefaultAIProvider().id })) }),
  research: router({
    workspace: protectedProcedure.query(({ ctx }) => ({ status: "READY", modes: ["MARKET", "QUANT", "RISK", "FIXED INCOME", "MACRO", "PORTFOLIO", "ACADEMIC", "GENERAL FINANCE"], ownerUserId: ctx.user.id })),
    sessions: protectedProcedure.query(({ ctx }) => listResearchSessions(ctx.user.id)),
    session: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(({ ctx, input }) => getResearchSession(input.sessionId, ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(255), mode: researchMode })).mutation(({ ctx, input }) => createResearchSession({ ownerUserId: ctx.user.id, title: input.title, mode: input.mode })),
    ask: protectedProcedure.input(z.object({ sessionId: z.number().int().positive().optional(), question: z.string().trim().min(3).max(8000), mode: researchMode })).mutation(({ ctx, input }) => runResearch({ ownerUserId: ctx.user.id, ...input })),
    delete: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ deleted: await deleteResearchSession(input.sessionId, ctx.user.id) })),
  }),
  data: router({ sources: publicProcedure.query(getDataHealth), coverage: publicProcedure.query(getHistoricalCoverage) }),
  settings: router({ preferences: publicProcedure.query(() => ({ theme: "institutional-dark", baseCurrency: "KES", timezone: "Africa/Nairobi" })) }),
  systemStatus: router({ health: publicProcedure.query(async () => ({ frontend: "READY", api: "READY", quantEngine: engineStatus().status, databaseSchema: process.env.DATABASE_URL ? "READY" : "DATA REQUIRED", marketConnectors: "CBK CONNECTED / CRM DATA REQUIRED" })) }),
  models: router({ registry: publicProcedure.query(async () => { const backendStatus = engineStatus().status === "LIVE" ? "READY" : engineStatus().status; const history = await getHistoricalCoverage(); return [
    { model: "Nelson-Siegel Yield Curve", category: "Fixed Income", status: backendStatus, input: "CBK tenor/yield points", output: "Interpolated curve", source: "Quant Engine" },
    { model: "Bond Analytics", category: "Fixed Income", status: backendStatus, input: "Coupon / YTM / maturity", output: "Duration / DV01 / convexity", source: "Quant Engine" },
    { model: "Black-Scholes-Merton", category: "Pricing", status: backendStatus, input: "Spot / strike / vol", output: "Price / Greeks", source: "Quant Engine" },
    { model: "CRR Binomial", category: "Pricing", status: backendStatus, input: "Spot / strike / steps", output: "Tree price / Greeks", source: "Quant Engine" },
    { model: "Monte Carlo", category: "Pricing", status: backendStatus, input: "Spot / paths / vol", output: "Price / convergence", source: "Quant Engine" },
    { model: "Portfolio VaR", category: "Risk", status: "DATA REQUIRED", input: "Positions / confidence", output: "VaR / CVaR / stress", source: "Quant Engine" },
    { model: "Historical Volatility / VaR / ES", category: "Risk", status: history.totalRecords >= 2 ? backendStatus : "DATA REQUIRED", input: "Validated historical observations", output: "Returns / volatility / tail risk", source: "FINTEL historical database" },
    { model: "Backtesting", category: "Risk", status: history.totalRecords >= 2 ? backendStatus : "DATA REQUIRED", input: "Validated historical observations", output: "Exceedances / rolling statistics", source: "FINTEL historical database" },
  ]; }) }),
});
export type AppRouter = typeof appRouter;


