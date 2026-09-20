import { datetime, int, index, mysqlEnum, mysqlTable, text, timestamp, decimal, varchar, json, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

const lineage = {
  observationDate: timestamp("observationDate"),
  publicationTimestamp: timestamp("publicationTimestamp"),
  retrievalTimestamp: timestamp("retrievalTimestamp"),
  frequency: varchar("frequency", { length: 32 }),
  currency: varchar("currency", { length: 8 }),
  sourceUrl: text("sourceUrl"),
  ingestionStatus: varchar("ingestionStatus", { length: 32 }),
  rawValue: text("rawValue"),
};

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(), openId: varchar("openId", { length: 64 }).notNull().unique(), name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }), role: mysqlEnum("role", ["user", "admin", "analyst", "client", "viewer"]).default("user").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const dataSources = mysqlTable("data_sources", {
  id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 128 }).notNull(), sourceType: varchar("sourceType", { length: 64 }).notNull(), endpoint: text("endpoint"), status: mysqlEnum("status", ["READY", "LIVE", "CURRENT", "STALE", "BACKFILLING", "DATA REQUIRED", "ERROR"]).default("DATA REQUIRED").notNull(), expectedFrequency: varchar("expectedFrequency", { length: 32 }), latestObservation: timestamp("latestObservation"), lastUpdated: timestamp("lastUpdated"), lastAttemptedAt: timestamp("lastAttemptedAt"), lastSuccessfulUpdate: timestamp("lastSuccessfulUpdate"), nextScheduledAt: timestamp("nextScheduledAt"), recordCount: int("recordCount").default(0), recordsRejected: int("recordsRejected").default(0), recordsInserted: int("recordsInserted").default(0), duplicates: int("duplicates").default(0), lastRunDurationMs: int("lastRunDurationMs"), progressPercent: decimal("progressPercent", { precision: 6, scale: 2 }).default("0"), lastError: text("lastError"), scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }), scheduleEnabled: boolean("scheduleEnabled").default(false), quality: varchar("quality", { length: 32 }).default("UNKNOWN"), createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({
  nameUnique: uniqueIndex("data_sources_name_unique").on(table.name),
  statusIdx: index("data_sources_status_idx").on(table.status),
  scheduleIdx: index("data_sources_schedule_idx").on(table.scheduleEnabled, table.nextScheduledAt),
}));

export const ingestionRuns = mysqlTable("ingestion_runs", {
  id: int("id").autoincrement().primaryKey(), sourceId: int("sourceId").notNull(), status: mysqlEnum("status", ["RUNNING", "CURRENT", "STALE", "BACKFILLING", "ERROR"]).notNull(), attemptedAt: timestamp("attemptedAt").defaultNow().notNull(), completedAt: timestamp("completedAt"), observationStart: timestamp("observationStart"), observationEnd: timestamp("observationEnd"), recordsImported: int("recordsImported").default(0), recordsRejected: int("recordsRejected").default(0), duplicates: int("duplicates").default(0), error: text("error"), metadata: json("metadata")
}, (table) => ({
  sourceIdx: index("ingestion_runs_source_idx").on(table.sourceId, table.attemptedAt),
  statusIdx: index("ingestion_runs_status_idx").on(table.status, table.attemptedAt),
}));

export const marketData = mysqlTable("market_data", { id: int("id").autoincrement().primaryKey(), instrument: varchar("instrument", { length: 128 }).notNull(), assetClass: varchar("assetClass", { length: 64 }).notNull(), value: decimal("value", { precision: 18, scale: 8 }), unit: varchar("unit", { length: 32 }), sourceId: int("sourceId"), asOf: timestamp("asOf"), quality: varchar("quality", { length: 32 }), createdAt: timestamp("createdAt").defaultNow().notNull(), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("market_data_observation_unique").on(table.instrument, table.observationDate),
  observationIdx: index("market_data_observation_idx").on(table.observationDate, table.assetClass),
  sourceIdx: index("market_data_source_idx").on(table.sourceId, table.observationDate),
}));
export const treasuryBills = mysqlTable("treasury_bills", { id: int("id").autoincrement().primaryKey(), tenorDays: int("tenorDays").notNull(), auctionDate: timestamp("auctionDate"), weightedAverageRate: decimal("weightedAverageRate", { precision: 8, scale: 5 }), acceptedAmountKes: decimal("acceptedAmountKes", { precision: 18, scale: 2 }), sourceId: int("sourceId"), quality: varchar("quality", { length: 32 }), createdAt: timestamp("createdAt").defaultNow().notNull(), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("treasury_bills_observation_unique").on(table.tenorDays, table.auctionDate),
  auctionIdx: index("treasury_bills_auction_idx").on(table.auctionDate, table.tenorDays),
  sourceIdx: index("treasury_bills_source_idx").on(table.sourceId, table.auctionDate),
}));
export const treasuryBonds = mysqlTable("treasury_bonds", { id: int("id").autoincrement().primaryKey(), securityCode: varchar("securityCode", { length: 64 }).notNull(), isin: varchar("isin", { length: 32 }), auctionDate: timestamp("auctionDate"), issueDate: timestamp("issueDate"), maturityDate: datetime("maturityDate"), tenorYears: decimal("tenorYears", { precision: 8, scale: 4 }), couponRate: decimal("couponRate", { precision: 8, scale: 5 }), couponFrequency: varchar("couponFrequency", { length: 32 }), pricePer100: decimal("pricePer100", { precision: 12, scale: 6 }), yieldToMaturity: decimal("yieldToMaturity", { precision: 8, scale: 5 }), weightedAverageYield: decimal("weightedAverageYield", { precision: 8, scale: 5 }), cutOffYield: decimal("cutOffYield", { precision: 8, scale: 5 }), faceValueKes: decimal("faceValueKes", { precision: 18, scale: 2 }), amountOfferedKes: decimal("amountOfferedKes", { precision: 18, scale: 2 }), bidsReceivedKes: decimal("bidsReceivedKes", { precision: 18, scale: 2 }), bidsAcceptedKes: decimal("bidsAcceptedKes", { precision: 18, scale: 2 }), amountAcceptedKes: decimal("amountAcceptedKes", { precision: 18, scale: 2 }), documentUrl: text("documentUrl"), duplicateKey: varchar("duplicateKey", { length: 255 }), validationStatus: varchar("validationStatus", { length: 32 }), reviewReason: text("reviewReason"), sourceId: int("sourceId"), quality: varchar("quality", { length: 32 }), createdAt: timestamp("createdAt").defaultNow().notNull(), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("treasury_bonds_duplicate_key_unique").on(table.duplicateKey),
  securityIdx: index("treasury_bonds_security_idx").on(table.securityCode, table.auctionDate),
  auctionIdx: index("treasury_bonds_auction_idx").on(table.auctionDate),
  sourceIdx: index("treasury_bonds_source_idx").on(table.sourceId, table.auctionDate),
}));
export const fxRates = mysqlTable("fx_rates", { id: int("id").autoincrement().primaryKey(), pair: varchar("pair", { length: 16 }).notNull(), rate: decimal("rate", { precision: 18, scale: 8 }), asOf: timestamp("asOf"), sourceId: int("sourceId"), quality: varchar("quality", { length: 32 }), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("fx_rates_observation_unique").on(table.pair, table.observationDate),
  observationIdx: index("fx_rates_observation_idx").on(table.observationDate, table.pair),
  sourceIdx: index("fx_rates_source_idx").on(table.sourceId, table.observationDate),
}));
export const historicalPrices = mysqlTable("historical_prices", { id: int("id").autoincrement().primaryKey(), instrument: varchar("instrument", { length: 128 }).notNull(), price: decimal("price", { precision: 18, scale: 8 }), asOf: timestamp("asOf").notNull(), sourceId: int("sourceId"), quality: varchar("quality", { length: 32 }), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("historical_prices_observation_unique").on(table.instrument, table.observationDate),
  seriesIdx: index("historical_prices_series_idx").on(table.instrument, table.observationDate),
  sourceIdx: index("historical_prices_source_idx").on(table.sourceId, table.observationDate),
}));
export const yieldCurve = mysqlTable("yield_curve", { id: int("id").autoincrement().primaryKey(), tenor: varchar("tenor", { length: 16 }).notNull(), maturityYears: decimal("maturityYears", { precision: 8, scale: 4 }).notNull(), yieldRate: decimal("yieldRate", { precision: 8, scale: 5 }), curveDate: timestamp("curveDate"), sourceId: int("sourceId"), quality: varchar("quality", { length: 32 }), ...lineage }, (table) => ({
  naturalKeyUnique: uniqueIndex("yield_curve_observation_unique").on(table.tenor, table.curveDate),
  curveDateIdx: index("yield_curve_date_idx").on(table.curveDate, table.tenor),
  sourceIdx: index("yield_curve_source_idx").on(table.sourceId, table.curveDate),
}));
export const instruments = mysqlTable("instruments", { id: int("id").autoincrement().primaryKey(), symbol: varchar("symbol", { length: 128 }).notNull(), name: varchar("name", { length: 255 }).notNull(), assetClass: varchar("assetClass", { length: 64 }).notNull(), currency: varchar("currency", { length: 8 }), securityCode: varchar("securityCode", { length: 64 }), isin: varchar("isin", { length: 32 }), sourceId: int("sourceId"), metadata: json("metadata"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => ({ symbolUnique: uniqueIndex("instruments_symbol_unique").on(table.symbol) }));
export const portfolios = mysqlTable("portfolios", { id: int("id").autoincrement().primaryKey(), ownerUserId: int("ownerUserId"), name: varchar("name", { length: 128 }).notNull(), description: text("description"), baseCurrency: varchar("baseCurrency", { length: 8 }).default("KES"), status: mysqlEnum("status", ["ACTIVE", "ARCHIVED", "DATA REQUIRED"]).default("ACTIVE").notNull(), valuationDate: timestamp("valuationDate"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => ({
  ownerIdx: index("portfolios_owner_idx").on(table.ownerUserId, table.updatedAt),
  statusIdx: index("portfolios_status_idx").on(table.status, table.updatedAt),
}));
export const portfolioPositions = mysqlTable("portfolio_positions", { id: int("id").autoincrement().primaryKey(), portfolioId: int("portfolioId").notNull(), instrumentId: int("instrumentId"), instrument: varchar("instrument", { length: 128 }).notNull(), assetClass: varchar("assetClass", { length: 64 }).notNull(), quantity: decimal("quantity", { precision: 18, scale: 8 }), marketValueKes: decimal("marketValueKes", { precision: 18, scale: 2 }), priceKes: decimal("priceKes", { precision: 18, scale: 8 }), currency: varchar("currency", { length: 8 }).default("KES"), positionDate: timestamp("positionDate"), duration: decimal("duration", { precision: 10, scale: 5 }), volatility: decimal("volatility", { precision: 10, scale: 5 }), metadata: json("metadata") }, (table) => ({
  portfolioIdx: index("portfolio_positions_portfolio_idx").on(table.portfolioId, table.positionDate),
  instrumentIdx: index("portfolio_positions_instrument_idx").on(table.instrumentId, table.positionDate),
}));
export const riskResults = mysqlTable("risk_results", { id: int("id").autoincrement().primaryKey(), portfolioId: int("portfolioId").notNull(), method: varchar("method", { length: 64 }).notNull(), confidence: decimal("confidence", { precision: 6, scale: 4 }), horizonDays: int("horizonDays"), varKes: decimal("varKes", { precision: 18, scale: 2 }), cvarKes: decimal("cvarKes", { precision: 18, scale: 2 }), stressJson: json("stressJson"), lineageJson: json("lineageJson"), calculatedAt: timestamp("calculatedAt").defaultNow().notNull() }, (table) => ({
  portfolioIdx: index("risk_results_portfolio_idx").on(table.portfolioId, table.calculatedAt),
  methodIdx: index("risk_results_method_idx").on(table.method, table.calculatedAt),
}));
export const pricingResults = mysqlTable("pricing_results", { id: int("id").autoincrement().primaryKey(), model: varchar("model", { length: 64 }).notNull(), instrument: varchar("instrument", { length: 128 }), inputJson: json("inputJson"), outputJson: json("outputJson"), calculatedAt: timestamp("calculatedAt").defaultNow().notNull() });
export const modelRuns = mysqlTable("model_runs", { id: int("id").autoincrement().primaryKey(), model: varchar("model", { length: 128 }).notNull(), category: varchar("category", { length: 64 }).notNull(), status: mysqlEnum("status", ["READY", "RUNNING", "DATA REQUIRED", "ERROR"]).default("READY").notNull(), inputJson: json("inputJson"), outputJson: json("outputJson"), dataSource: varchar("dataSource", { length: 128 }), lastRun: timestamp("lastRun") });
export const systemStatus = mysqlTable("system_status", { id: int("id").autoincrement().primaryKey(), service: varchar("service", { length: 128 }).notNull(), status: varchar("status", { length: 32 }).notNull(), message: text("message"), checkedAt: timestamp("checkedAt").defaultNow().notNull() });
export const auditLogs = mysqlTable("audit_logs", { id: int("id").autoincrement().primaryKey(), actorUserId: int("actorUserId"), action: varchar("action", { length: 128 }).notNull(), resourceType: varchar("resourceType", { length: 64 }).notNull(), resourceId: varchar("resourceId", { length: 128 }), result: varchar("result", { length: 32 }).notNull(), requestId: varchar("requestId", { length: 128 }), metadata: json("metadata"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({
  actorIdx: index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
  resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId, table.createdAt),
}));


export const researchSessions = mysqlTable("research_sessions", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["CURRENT", "PARTIAL", "DATA_REQUIRED", "UNVERIFIED", "ERROR"]).default("CURRENT").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerIdx: index("research_sessions_owner_idx").on(table.ownerUserId, table.updatedAt),
}));

export const researchMessages = mysqlTable("research_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  evidenceJson: json("evidenceJson"),
  quantResultsJson: json("quantResultsJson"),
  sourcesJson: json("sourcesJson"),
  assumptionsJson: json("assumptionsJson"),
  limitationsJson: json("limitationsJson"),
  status: varchar("status", { length: 32 }).notNull().default("CURRENT"),
  model: varchar("model", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("research_messages_session_idx").on(table.sessionId, table.createdAt),
}));

export const researchDocuments = mysqlTable("research_documents", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  contentHash: varchar("contentHash", { length: 128 }).notNull(),
  storageKey: text("storageKey"),
  status: mysqlEnum("status", ["READY", "PROCESSING", "ERROR"]).default("PROCESSING").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index("research_documents_owner_idx").on(table.ownerUserId, table.createdAt),
  hashIdx: index("research_documents_hash_idx").on(table.ownerUserId, table.contentHash),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
