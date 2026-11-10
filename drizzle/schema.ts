import { boolean, decimal, index, integer, json, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

const usersRoleEnum = pgEnum("users_role", ["user", "admin", "analyst", "client", "viewer"]);
const dataSourcesStatusEnum = pgEnum("data_sources_status", ["READY", "LIVE", "CURRENT", "STALE", "BACKFILLING", "DATA REQUIRED", "ERROR"]);
const ingestionRunsStatusEnum = pgEnum("ingestion_runs_status", ["RUNNING", "CURRENT", "STALE", "BACKFILLING", "ERROR"]);
const portfoliosStatusEnum = pgEnum("portfolios_status", ["ACTIVE", "ARCHIVED", "DATA REQUIRED"]);
const modelRunsStatusEnum = pgEnum("model_runs_status", ["READY", "RUNNING", "DATA REQUIRED", "ERROR"]);
const researchSessionsStatusEnum = pgEnum("research_sessions_status", ["CURRENT", "PARTIAL", "DATA_REQUIRED", "UNVERIFIED", "ERROR"]);
const researchMessagesRoleEnum = pgEnum("research_messages_role", ["user", "assistant", "system"]);
const researchDocumentsStatusEnum = pgEnum("research_documents_status", ["READY", "PROCESSING", "ERROR"]);

const lineage = {
  observationDate: timestamp("observationDate", { withTimezone: true, mode: "date" }),
  publicationTimestamp: timestamp("publicationTimestamp", { withTimezone: true, mode: "date" }),
  retrievalTimestamp: timestamp("retrievalTimestamp", { withTimezone: true, mode: "date" }),
  frequency: varchar("frequency", { length: 32 }),
  currency: varchar("currency", { length: 8 }),
  sourceUrl: text("sourceUrl"),
  ingestionStatus: varchar("ingestionStatus", { length: 32 }),
  rawValue: text("rawValue"),
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(), openId: varchar("openId", { length: 64 }).notNull().unique(), name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }), role: usersRoleEnum("role").default("user").notNull(), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(), lastSignedIn: timestamp("lastSignedIn", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(), name: varchar("name", { length: 128 }).notNull(), sourceType: varchar("sourceType", { length: 64 }).notNull(), endpoint: text("endpoint"), status: dataSourcesStatusEnum("status").default("DATA REQUIRED").notNull(), expectedFrequency: varchar("expectedFrequency", { length: 32 }), latestObservation: timestamp("latestObservation", { withTimezone: true, mode: "date" }), lastUpdated: timestamp("lastUpdated", { withTimezone: true, mode: "date" }), lastAttemptedAt: timestamp("lastAttemptedAt", { withTimezone: true, mode: "date" }), lastSuccessfulUpdate: timestamp("lastSuccessfulUpdate", { withTimezone: true, mode: "date" }), nextScheduledAt: timestamp("nextScheduledAt", { withTimezone: true, mode: "date" }), recordCount: integer("recordCount").default(0), recordsRejected: integer("recordsRejected").default(0), recordsInserted: integer("recordsInserted").default(0), duplicates: integer("duplicates").default(0), lastRunDurationMs: integer("lastRunDurationMs"), progressPercent: decimal("progressPercent", { precision: 6, scale: 2 }).default("0"), lastError: text("lastError"), scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }), scheduleEnabled: boolean("scheduleEnabled").default(false), quality: varchar("quality", { length: 32 }).default("UNKNOWN"), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull()
}, (table) => ({
  nameUnique: uniqueIndex("data_sources_name_unique").on(table.name),
  statusIdx: index("data_sources_status_idx").on(table.status),
  scheduleIdx: index("data_sources_schedule_idx").on(table.scheduleEnabled, table.nextScheduledAt),
}));

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(), sourceId: integer("sourceId").notNull(), status: ingestionRunsStatusEnum("status").notNull(), attemptedAt: timestamp("attemptedAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(), completedAt: timestamp("completedAt", { withTimezone: true, mode: "date" }), observationStart: timestamp("observationStart", { withTimezone: true, mode: "date" }), observationEnd: timestamp("observationEnd", { withTimezone: true, mode: "date" }), recordsImported: integer("recordsImported").default(0), recordsRejected: integer("recordsRejected").default(0), duplicates: integer("duplicates").default(0), error: text("error"), metadata: json("metadata")
}, (table) => ({
  sourceIdx: index("ingestion_runs_source_idx").on(table.sourceId, table.attemptedAt),
  statusIdx: index("ingestion_runs_status_idx").on(table.status, table.attemptedAt),
}));

export const marketData = pgTable("market_data", { id: serial("id").primaryKey(), instrument: varchar("instrument", { length: 128 }).notNull(), assetClass: varchar("assetClass", { length: 64 }).notNull(), value: decimal("value", { precision: 18, scale: 8 }), unit: varchar("unit", { length: 32 }), sourceId: integer("sourceId"), asOf: timestamp("asOf", { withTimezone: true, mode: "date" }), quality: varchar("quality", { length: 32 }), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("market_data_observation_unique").on(table.instrument, table.observationDate),
  observationIdx: index("market_data_observation_idx").on(table.observationDate, table.assetClass),
  sourceIdx: index("market_data_source_idx").on(table.sourceId, table.observationDate),
}));
export const treasuryBills = pgTable("treasury_bills", { id: serial("id").primaryKey(), tenorDays: integer("tenorDays").notNull(), auctionDate: timestamp("auctionDate", { withTimezone: true, mode: "date" }), issueDate: timestamp("issueDate", { withTimezone: true, mode: "date" }), weightedAverageRate: decimal("weightedAverageRate", { precision: 8, scale: 5 }), acceptedAmountKes: decimal("acceptedAmountKes", { precision: 18, scale: 2 }), sourceId: integer("sourceId"), quality: varchar("quality", { length: 32 }), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("treasury_bills_observation_unique").on(table.tenorDays, table.issueDate),
  auctionIdx: index("treasury_bills_auction_idx").on(table.auctionDate, table.tenorDays),
  issueIdx: index("treasury_bills_issue_date_idx").on(table.issueDate, table.tenorDays),
  sourceIdx: index("treasury_bills_source_idx").on(table.sourceId, table.auctionDate),
}));
export const treasuryBonds = pgTable("treasury_bonds", { id: serial("id").primaryKey(), securityCode: varchar("securityCode", { length: 64 }).notNull(), isin: varchar("isin", { length: 32 }), auctionDate: timestamp("auctionDate", { withTimezone: true, mode: "date" }), issueDate: timestamp("issueDate", { withTimezone: true, mode: "date" }), maturityDate: timestamp("maturityDate", { withTimezone: true, mode: "date" }), tenorYears: decimal("tenorYears", { precision: 8, scale: 4 }), couponRate: decimal("couponRate", { precision: 8, scale: 5 }), couponFrequency: varchar("couponFrequency", { length: 32 }), pricePer100: decimal("pricePer100", { precision: 12, scale: 6 }), yieldToMaturity: decimal("yieldToMaturity", { precision: 8, scale: 5 }), weightedAverageYield: decimal("weightedAverageYield", { precision: 8, scale: 5 }), cutOffYield: decimal("cutOffYield", { precision: 8, scale: 5 }), faceValueKes: decimal("faceValueKes", { precision: 18, scale: 2 }), amountOfferedKes: decimal("amountOfferedKes", { precision: 18, scale: 2 }), bidsReceivedKes: decimal("bidsReceivedKes", { precision: 18, scale: 2 }), bidsAcceptedKes: decimal("bidsAcceptedKes", { precision: 18, scale: 2 }), amountAcceptedKes: decimal("amountAcceptedKes", { precision: 18, scale: 2 }), documentUrl: text("documentUrl"), duplicateKey: varchar("duplicateKey", { length: 255 }), validationStatus: varchar("validationStatus", { length: 32 }), reviewReason: text("reviewReason"), sourceId: integer("sourceId"), quality: varchar("quality", { length: 32 }), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("treasury_bonds_duplicate_key_unique").on(table.duplicateKey),
  securityIdx: index("treasury_bonds_security_idx").on(table.securityCode, table.auctionDate),
  auctionIdx: index("treasury_bonds_auction_idx").on(table.auctionDate),
  sourceIdx: index("treasury_bonds_source_idx").on(table.sourceId, table.auctionDate),
}));
export const fxRates = pgTable("fx_rates", { id: serial("id").primaryKey(), pair: varchar("pair", { length: 16 }).notNull(), rate: decimal("rate", { precision: 18, scale: 8 }), asOf: timestamp("asOf", { withTimezone: true, mode: "date" }), sourceId: integer("sourceId"), quality: varchar("quality", { length: 32 }), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("fx_rates_observation_unique").on(table.pair, table.observationDate),
  observationIdx: index("fx_rates_observation_idx").on(table.observationDate, table.pair),
  sourceIdx: index("fx_rates_source_idx").on(table.sourceId, table.observationDate),
}));
export const historicalPrices = pgTable("historical_prices", { id: serial("id").primaryKey(), instrument: varchar("instrument", { length: 128 }).notNull(), price: decimal("price", { precision: 18, scale: 8 }), asOf: timestamp("asOf", { withTimezone: true, mode: "date" }).notNull(), sourceId: integer("sourceId"), quality: varchar("quality", { length: 32 }), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("historical_prices_observation_unique").on(table.instrument, table.observationDate),
  seriesIdx: index("historical_prices_series_idx").on(table.instrument, table.observationDate),
  sourceIdx: index("historical_prices_source_idx").on(table.sourceId, table.observationDate),
}));
export const yieldCurve = pgTable("yield_curve", { id: serial("id").primaryKey(), tenor: varchar("tenor", { length: 16 }).notNull(), maturityYears: decimal("maturityYears", { precision: 8, scale: 4 }).notNull(), yieldRate: decimal("yieldRate", { precision: 8, scale: 5 }), curveDate: timestamp("curveDate", { withTimezone: true, mode: "date" }), sourceId: integer("sourceId"), quality: varchar("quality", { length: 32 }), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("yield_curve_observation_unique").on(table.tenor, table.curveDate),
  curveDateIdx: index("yield_curve_date_idx").on(table.curveDate, table.tenor),
  sourceIdx: index("yield_curve_source_idx").on(table.sourceId, table.curveDate),
}));
export const instruments = pgTable("instruments", { id: serial("id").primaryKey(), symbol: varchar("symbol", { length: 128 }).notNull(), name: varchar("name", { length: 255 }).notNull(), assetClass: varchar("assetClass", { length: 64 }).notNull(), currency: varchar("currency", { length: 8 }), securityCode: varchar("securityCode", { length: 64 }), isin: varchar("isin", { length: 32 }), sourceId: integer("sourceId"), metadata: json("metadata"), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull() }, (table) => ({ symbolUnique: uniqueIndex("instruments_symbol_unique").on(table.symbol) }));
export const portfolios = pgTable("portfolios", { id: serial("id").primaryKey(), ownerUserId: integer("ownerUserId"), name: varchar("name", { length: 128 }).notNull(), description: text("description"), baseCurrency: varchar("baseCurrency", { length: 8 }).default("KES"), status: portfoliosStatusEnum("status").default("ACTIVE").notNull(), valuationDate: timestamp("valuationDate", { withTimezone: true, mode: "date" }), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(), updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull() }, (table) => ({
  ownerIdx: index("portfolios_owner_idx").on(table.ownerUserId, table.updatedAt),
  statusIdx: index("portfolios_status_idx").on(table.status, table.updatedAt),
}));
export const portfolioPositions = pgTable("portfolio_positions", { id: serial("id").primaryKey(), portfolioId: integer("portfolioId").notNull(), instrumentId: integer("instrumentId"), instrument: varchar("instrument", { length: 128 }).notNull(), assetClass: varchar("assetClass", { length: 64 }).notNull(), quantity: decimal("quantity", { precision: 18, scale: 8 }), marketValueKes: decimal("marketValueKes", { precision: 18, scale: 2 }), priceKes: decimal("priceKes", { precision: 18, scale: 8 }), currency: varchar("currency", { length: 8 }).default("KES"), positionDate: timestamp("positionDate", { withTimezone: true, mode: "date" }), duration: decimal("duration", { precision: 10, scale: 5 }), volatility: decimal("volatility", { precision: 10, scale: 5 }), metadata: json("metadata") }, (table) => ({
  portfolioIdx: index("portfolio_positions_portfolio_idx").on(table.portfolioId, table.positionDate),
  instrumentIdx: index("portfolio_positions_instrument_idx").on(table.instrumentId, table.positionDate),
}));
export const riskResults = pgTable("risk_results", { id: serial("id").primaryKey(), portfolioId: integer("portfolioId").notNull(), method: varchar("method", { length: 64 }).notNull(), confidence: decimal("confidence", { precision: 6, scale: 4 }), horizonDays: integer("horizonDays"), varKes: decimal("varKes", { precision: 18, scale: 2 }), cvarKes: decimal("cvarKes", { precision: 18, scale: 2 }), stressJson: json("stressJson"), lineageJson: json("lineageJson"), calculatedAt: timestamp("calculatedAt", { withTimezone: true, mode: "date" }).defaultNow().notNull() }, (table) => ({
  portfolioIdx: index("risk_results_portfolio_idx").on(table.portfolioId, table.calculatedAt),
  methodIdx: index("risk_results_method_idx").on(table.method, table.calculatedAt),
}));
export const pricingResults = pgTable("pricing_results", { id: serial("id").primaryKey(), model: varchar("model", { length: 64 }).notNull(), instrument: varchar("instrument", { length: 128 }), inputJson: json("inputJson"), outputJson: json("outputJson"), calculatedAt: timestamp("calculatedAt", { withTimezone: true, mode: "date" }).defaultNow().notNull() });
export const modelRuns = pgTable("model_runs", { id: serial("id").primaryKey(), model: varchar("model", { length: 128 }).notNull(), category: varchar("category", { length: 64 }).notNull(), status: modelRunsStatusEnum("status").default("READY").notNull(), inputJson: json("inputJson"), outputJson: json("outputJson"), dataSource: varchar("dataSource", { length: 128 }), lastRun: timestamp("lastRun", { withTimezone: true, mode: "date" }) });
export const systemStatus = pgTable("system_status", { id: serial("id").primaryKey(), service: varchar("service", { length: 128 }).notNull(), status: varchar("status", { length: 32 }).notNull(), message: text("message"), checkedAt: timestamp("checkedAt", { withTimezone: true, mode: "date" }).defaultNow().notNull() });
export const auditLogs = pgTable("audit_logs", { id: serial("id").primaryKey(), actorUserId: integer("actorUserId"), action: varchar("action", { length: 128 }).notNull(), resourceType: varchar("resourceType", { length: 64 }).notNull(), resourceId: varchar("resourceId", { length: 128 }), result: varchar("result", { length: 32 }).notNull(), requestId: varchar("requestId", { length: 128 }), metadata: json("metadata"), createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull() }, (table) => ({
  actorIdx: index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
  resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId, table.createdAt),
}));


export const researchSessions = pgTable("research_sessions", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("ownerUserId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 32 }).notNull(),
  status: researchSessionsStatusEnum("status").default("CURRENT").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  ownerIdx: index("research_sessions_owner_idx").on(table.ownerUserId, table.updatedAt),
}));

export const researchMessages = pgTable("research_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull(),
  role: researchMessagesRoleEnum("role").notNull(),
  content: text("content").notNull(),
  evidenceJson: json("evidenceJson"),
  quantResultsJson: json("quantResultsJson"),
  sourcesJson: json("sourcesJson"),
  assumptionsJson: json("assumptionsJson"),
  limitationsJson: json("limitationsJson"),
  status: varchar("status", { length: 32 }).notNull().default("CURRENT"),
  model: varchar("model", { length: 128 }),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("research_messages_session_idx").on(table.sessionId, table.createdAt),
}));

export const researchDocuments = pgTable("research_documents", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("ownerUserId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  contentHash: varchar("contentHash", { length: 128 }).notNull(),
  storageKey: text("storageKey"),
  status: researchDocumentsStatusEnum("status").default("PROCESSING").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index("research_documents_owner_idx").on(table.ownerUserId, table.createdAt),
  hashIdx: index("research_documents_hash_idx").on(table.ownerUserId, table.contentHash),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
