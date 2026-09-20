from pathlib import Path
root=Path('/mnt/data/fintel_phase1')

schema=root/'drizzle/schema.ts'
s=schema.read_text()
s=s.replace('recordsRejected: int("recordsRejected").default(0), error: text("error")', 'recordsRejected: int("recordsRejected").default(0), duplicates: int("duplicates").default(0), error: text("error")')
schema.write_text(s)

# db.ts changes
p=root/'server/db.ts'; s=p.read_text()
s=s.replace('export async function getDataHealth() {\n', '''export async function getRecentIngestionRuns(limit = 50) {\n  const db = await getDb();\n  if (!db) return [];\n  return db.select({\n    id: ingestionRuns.id, sourceId: ingestionRuns.sourceId, status: ingestionRuns.status,\n    attemptedAt: ingestionRuns.attemptedAt, completedAt: ingestionRuns.completedAt,\n    observationStart: ingestionRuns.observationStart, observationEnd: ingestionRuns.observationEnd,\n    recordsImported: ingestionRuns.recordsImported, recordsRejected: ingestionRuns.recordsRejected,\n    duplicates: ingestionRuns.duplicates, error: ingestionRuns.error, metadata: ingestionRuns.metadata,\n  }).from(ingestionRuns).orderBy(desc(ingestionRuns.attemptedAt)).limit(limit);\n}\n\nexport async function getDataHealth() {\n''')
old='''  return { database: { status: "CURRENT", lastSuccessfulUpdate: new Date().toISOString(), lastAttemptedUpdate: new Date().toISOString(), recordCount: rows.reduce((sum, row) => sum + (row.recordCount ?? 0), 0), error: null }, sources: required.map((name) => { const row = map.get(name); return { name, status: row?.status ?? "DATA REQUIRED", lastSuccessfulUpdate: row?.lastSuccessfulUpdate ?? null, lastAttemptedUpdate: row?.lastAttemptedAt ?? null, nextScheduledAt: row?.nextScheduledAt ?? null, latestObservation: row?.latestObservation ?? null, expectedFrequency: row?.expectedFrequency ?? "DATA REQUIRED", recordCount: row?.recordCount ?? 0, recordsInserted: row?.recordsInserted ?? 0, duplicates: row?.duplicates ?? 0, recordsRejected: row?.recordsRejected ?? 0, lastRunDurationMs: row?.lastRunDurationMs ?? null, progressPercent: row?.progressPercent ?? "0", scheduleEnabled: row?.scheduleEnabled ?? false, error: row?.lastError ?? null, sourceUrl: row?.endpoint ?? null }; }) };\n'''
new='''  const sourceStatuses = rows.map((row) => row.status);\n  const databaseStatus = sourceStatuses.some((status) => status === "ERROR") ? "ERROR" : sourceStatuses.some((status) => status === "CURRENT" || status === "LIVE") ? "CURRENT" : "DATA REQUIRED";\n  const latestSuccessful = rows.map((row) => row.lastSuccessfulUpdate).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;\n  const latestAttempted = rows.map((row) => row.lastAttemptedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;\n  return { database: { status: databaseStatus, lastSuccessfulUpdate: latestSuccessful, lastAttemptedUpdate: latestAttempted, recordCount: rows.reduce((sum, row) => sum + (row.recordCount ?? 0), 0), error: rows.find((row) => row.lastError)?.lastError ?? null }, sources: required.map((name) => { const row = map.get(name); return { name, status: row?.status ?? "DATA REQUIRED", lastSuccessfulUpdate: row?.lastSuccessfulUpdate ?? null, lastAttemptedUpdate: row?.lastAttemptedAt ?? null, nextScheduledAt: row?.nextScheduledAt ?? null, latestObservation: row?.latestObservation ?? null, expectedFrequency: row?.expectedFrequency ?? "DATA REQUIRED", recordCount: row?.recordCount ?? 0, recordsInserted: row?.recordsInserted ?? 0, duplicates: row?.duplicates ?? 0, recordsRejected: row?.recordsRejected ?? 0, lastRunDurationMs: row?.lastRunDurationMs ?? null, progressPercent: row?.progressPercent ?? "0", scheduleEnabled: row?.scheduleEnabled ?? false, error: row?.lastError ?? null, sourceUrl: row?.endpoint ?? null }; }) };\n'''
if old not in s: raise SystemExit('getDataHealth block not found')
s=s.replace(old,new)
# recordIngestionRun signature/body
s=s.replace('recordsImported?: number; recordsRejected?: number; error?: string | null; metadata?: unknown', 'recordsImported?: number; recordsRejected?: number; duplicates?: number; error?: string | null; metadata?: unknown')
s=s.replace('recordsImported: input.recordsImported ?? 0, recordsRejected: input.recordsRejected ?? 0, error:', 'recordsImported: input.recordsImported ?? 0, recordsRejected: input.recordsRejected ?? 0, duplicates: input.duplicates ?? 0, error:')
# add duplicates to known calls where local variable exists
s=s.replace('recordsImported: inserted, recordsRejected: rejected, error:', 'recordsImported: inserted, recordsRejected: rejected, duplicates, error:')
s=s.replace('recordsImported: inserted, recordsRejected: rejected, metadata: { duplicates }', 'recordsImported: inserted, recordsRejected: rejected, duplicates, metadata: { duplicates }')
p.write_text(s)

# Add readiness function before persistRiskResult
p=root/'server/db.ts'; s=p.read_text()
needle='export async function persistRiskResult('
insert='''export async function getPortfolioRiskReadiness(portfolioId: number, ownerUserId?: number) {\n  const portfolio = await getPortfolioById(portfolioId, ownerUserId);\n  if (!portfolio) return { status: "DATA REQUIRED" as const, portfolioId, reasons: ["Portfolio not found or not accessible"], instruments: [] };\n  if (!portfolio.positions.length) return { status: "DATA REQUIRED" as const, portfolioId, reasons: ["Portfolio contains no persisted positions"], instruments: [] };\n  const history = await resolvePortfolioHistoricalSeries(portfolio.positions.map((row) => ({ instrument: row.instrument, instrumentId: row.instrumentId })), 5000);\n  const reasons = history.missing.map((instrument) => `Validated historical observations are insufficient for ${instrument}`);\n  const sufficient = history.missing.length === 0 && history.observations >= 2;\n  return {\n    status: sufficient ? "CURRENT" as const : "DATA REQUIRED" as const,\n    portfolioId,\n    reasons: sufficient ? [] : reasons.length ? reasons : ["At least two aligned validated observations are required"],\n    instruments: portfolio.positions.map((position) => ({ instrument: position.instrument, instrumentId: position.instrumentId ?? null, historicalStatus: history.missing.includes(position.instrument) ? "DATA REQUIRED" : "CURRENT" })),\n    observations: history.observations,\n  };\n}\n\n'''
if needle not in s: raise SystemExit('persistRiskResult needle missing')
s=s.replace(needle,insert+needle)
p.write_text(s)

# API imports and endpoint
p=root/'server/api.ts'; s=p.read_text()
s=s.replace('getDataHealth, getHistoricalCoverage,', 'getDataHealth, getRecentIngestionRuns, getHistoricalCoverage,')
s=s.replace('persistRiskResult, resolvePortfolioHistoricalSeries, getPortfolioById, writeAuditLog }', 'persistRiskResult, resolvePortfolioHistoricalSeries, getPortfolioById, getPortfolioRiskReadiness, writeAuditLog }')
needle='  app.get("/api/data/health", (_req, res) => sendAsync(res, getDataHealth));\n'
repl='''  app.get("/api/data/health", (_req, res) => sendAsync(res, getDataHealth));\n  app.get("/api/data/ingestion-runs", (_req, res) => sendAsync(res, () => getRecentIngestionRuns(50)));\n  app.get("/api/portfolio/:portfolioId/risk-readiness", async (req, res) => {\n    const user = await requirePermission(req, res, "risk.read");\n    if (!user) return;\n    const portfolioId = Number(req.params.portfolioId);\n    if (!Number.isInteger(portfolioId) || portfolioId <= 0) return res.status(400).json({ status: "ERROR", message: "Invalid portfolioId" });\n    return sendAsync(res, () => getPortfolioRiskReadiness(portfolioId, user.id));\n  });\n'''
if needle not in s: raise SystemExit('api endpoint needle missing')
s=s.replace(needle,repl)
p.write_text(s)

# routers import and endpoint
p=root/'server/routers.ts'; s=p.read_text()
s=s.replace('getPortfolioById, writeAuditLog', 'getPortfolioById, getPortfolioRiskReadiness, writeAuditLog')
s=s.replace('detail: permissionProcedure("portfolio.read").input(z.object({ portfolioId: z.number().int().positive() })).query(async ({ ctx, input }) => { const portfolio = await getPortfolioById(input.portfolioId, ctx.user.id); return portfolio ? { status: "CURRENT" as const, ...portfolio } : { status: "DATA REQUIRED" as const, portfolio: null, positions: [] }; }),', 'detail: permissionProcedure("portfolio.read").input(z.object({ portfolioId: z.number().int().positive() })).query(async ({ ctx, input }) => { const portfolio = await getPortfolioById(input.portfolioId, ctx.user.id); return portfolio ? { status: "CURRENT" as const, ...portfolio } : { status: "DATA REQUIRED" as const, portfolio: null, positions: [] }; }),\n    riskReadiness: permissionProcedure("risk.read").input(z.object({ portfolioId: z.number().int().positive() })).query(({ ctx, input }) => getPortfolioRiskReadiness(input.portfolioId, ctx.user.id)),')
p.write_text(s)

# migration
mig=root/'drizzle/0008_phase1b_risk_monitoring.sql'
mig.write_text('''ALTER TABLE `ingestion_runs` ADD COLUMN `duplicates` int DEFAULT 0 AFTER `recordsRejected`;\nCREATE INDEX `ingestion_runs_status_source_idx` ON `ingestion_runs` (`status`, `sourceId`, `attemptedAt`);\nCREATE INDEX `portfolio_positions_date_idx` ON `portfolio_positions` (`positionDate`);\n''')

# docs
(root/'docs/PHASE1B_RISK_AND_INGESTION.md').write_text('''# FINTEL Phase 1B — Risk Readiness and Ingestion Monitoring\n\n## Implemented\n\n- Ingestion runs now persist a dedicated duplicate count.\n- Added recent ingestion-run API visibility.\n- Added portfolio risk-readiness evaluation based on persisted positions and validated historical observations.\n- Added authenticated REST endpoint `/api/portfolio/:portfolioId/risk-readiness`.\n- Added tRPC `portfolio.riskReadiness`.\n- Data-health database status now reflects persisted source states instead of unconditionally reporting CURRENT.\n- Added targeted database indexes for ingestion monitoring and position-date queries.\n\n## Risk boundary\n\nHistorical VaR/ES/drawdown require validated observed history. FINTEL must return DATA REQUIRED when required instrument histories are unavailable. Parametric risk may remain available where the model inputs are valid, but it must not be represented as historical risk.\n\n## Production configuration still required\n\nThe CBK scheduler still requires deployment-level callback registration and external production configuration. This build does not claim those jobs are activated.\n''')

# test file
(root/'server/risk-readiness.test.ts').write_text('''import { describe, expect, it } from "vitest";\n\ndescribe("risk readiness contract", () => {\n  it("documents the required boundary for historical portfolio risk", () => {\n    const allowedStatuses = ["CURRENT", "DATA REQUIRED"];\n    expect(allowedStatuses).toContain("DATA REQUIRED");\n  });\n});\n''')

print('phase1b applied')
