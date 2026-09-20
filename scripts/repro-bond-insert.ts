import { getDb } from "../server/db";
import { treasuryBonds } from "../drizzle/schema";
import { fetchTreasuryBondDocuments } from "../server/ingestion/phase2";

const db = await getDb();
if (!db) throw new Error("Database unavailable");
const batch = await fetchTreasuryBondDocuments({ maxDocuments: 3 });
const row = batch.records.find((item) => item.validationStatus === "VALID");
if (!row) throw new Error(JSON.stringify(batch.errors));
const money = (value: number | null) => value === null ? null : value.toFixed(2);
try {
  await db.transaction(async (tx) => {
    await tx.insert(treasuryBonds).values({
      securityCode: row.securityCode, isin: row.isin, auctionDate: row.auctionDate, issueDate: row.issueDate, maturityDate: row.maturityDate, tenorYears: row.tenorYears?.toFixed(4) ?? null, couponRate: row.couponRate?.toFixed(5) ?? null, pricePer100: row.pricePer100?.toFixed(6) ?? null, yieldToMaturity: row.yieldToMaturity?.toFixed(5) ?? null, weightedAverageYield: row.weightedAverageYield?.toFixed(5) ?? null, cutOffYield: row.cutOffYield?.toFixed(5) ?? null, amountOfferedKes: money(row.amountOfferedKes), bidsReceivedKes: money(row.bidsReceivedKes), bidsAcceptedKes: money(row.bidsAcceptedKes), amountAcceptedKes: money(row.amountAcceptedKes), documentUrl: row.documentUrl, duplicateKey: `DEBUG|${Date.now()}`, validationStatus: row.validationStatus, reviewReason: row.reviewReason, sourceId: 3, quality: "VALIDATED", createdAt: new Date(), observationDate: row.observationDate, publicationTimestamp: new Date(), retrievalTimestamp: new Date(), frequency: row.frequency, currency: row.currency, sourceUrl: row.sourceUrl, ingestionStatus: "CURRENT", rawValue: row.rawValue,
    } as any);
    throw new Error("ROLLBACK_DEBUG");
  });
} catch (error) {
  console.error(error);
  process.exitCode = error instanceof Error && error.message === "ROLLBACK_DEBUG" ? 0 : 1;
}
