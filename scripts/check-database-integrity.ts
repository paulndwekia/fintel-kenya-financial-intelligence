import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required for the FINTEL integrity preflight");

const checks = [
  ["data_sources.name", sql`SELECT name, COUNT(*) AS duplicate_count FROM data_sources GROUP BY name HAVING COUNT(*) > 1 LIMIT 10`],
  ["market_data.instrument+observationDate", sql`SELECT instrument, observationDate, COUNT(*) AS duplicate_count FROM market_data GROUP BY instrument, observationDate HAVING COUNT(*) > 1 LIMIT 10`],
  ["fx_rates.pair+observationDate", sql`SELECT pair, observationDate, COUNT(*) AS duplicate_count FROM fx_rates GROUP BY pair, observationDate HAVING COUNT(*) > 1 LIMIT 10`],
  ["historical_prices.instrument+observationDate", sql`SELECT instrument, observationDate, COUNT(*) AS duplicate_count FROM historical_prices GROUP BY instrument, observationDate HAVING COUNT(*) > 1 LIMIT 10`],
  ["treasury_bills.tenorDays+auctionDate", sql`SELECT tenorDays, auctionDate, COUNT(*) AS duplicate_count FROM treasury_bills GROUP BY tenorDays, auctionDate HAVING COUNT(*) > 1 LIMIT 10`],
  ["treasury_bonds.duplicateKey", sql`SELECT duplicateKey, COUNT(*) AS duplicate_count FROM treasury_bonds WHERE duplicateKey IS NOT NULL GROUP BY duplicateKey HAVING COUNT(*) > 1 LIMIT 10`],
  ["yield_curve.tenor+curveDate", sql`SELECT tenor, curveDate, COUNT(*) AS duplicate_count FROM yield_curve GROUP BY tenor, curveDate HAVING COUNT(*) > 1 LIMIT 10`],
] as const;

let failures = 0;
for (const [label, query] of checks) {
  const [rows] = await db.execute(query);
  const count = Array.isArray(rows) ? rows.length : 0;
  if (count) {
    failures += count;
    console.error(`[DUPLICATES] ${label}: ${count} duplicate groups found`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

if (failures) {
  console.error(`Integrity preflight failed with ${failures} duplicate groups. No migration should be applied until these are reviewed.`);
  process.exit(1);
}

console.log("FINTEL database integrity preflight passed. Safe to apply 0007_fintel_integrity_hardening.sql.");
