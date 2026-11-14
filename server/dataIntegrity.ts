/**
 * Canonical natural-key helpers used by FINTEL ingestion and integrity tests.
 * These keys describe an observation, not a row id. They intentionally exclude
 * retrieval timestamps so repeated retrievals of the same market observation
 * remain idempotent.
 */

export function observationDayKey(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function marketObservationKey(instrument: string, observationDate: Date): string {
  return `${instrument.trim().toUpperCase()}|${observationDayKey(observationDate)}`;
}

export function fxObservationKey(pair: string, observationDate: Date): string {
  return `${pair.trim().toUpperCase()}|${observationDayKey(observationDate)}`;
}

export function treasuryBillObservationKey(tenorDays: number, issueDate: Date): string {
  return `${tenorDays}|${observationDayKey(issueDate)}`;
}

export function historicalObservationKey(instrument: string, observationDate: Date): string {
  return `${instrument.trim().toUpperCase()}|${observationDayKey(observationDate)}`;
}

export function yieldCurveObservationKey(tenor: string, curveDate: Date): string {
  return `${tenor.trim().toUpperCase()}|${observationDayKey(curveDate)}`;
}

export function treasuryBondObservationKey(securityCode: string, auctionDate: Date | null): string {
  return `${securityCode.trim().toUpperCase()}|${observationDayKey(auctionDate) ?? "UNKNOWN"}`;
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; errno?: unknown; message?: unknown };
  return candidate.code === "23505" || candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062 || (typeof candidate.message === "string" && /duplicate entry|duplicate key/i.test(candidate.message));
}


/**
 * Classify the freshness of a persisted dataset using its latest validated
 * observation. Parse rejections and document-level warnings are deliberately
 * tracked separately: one malformed historical PDF must not make a fresh,
 * validated auction result appear stale.
 */
export function classifyObservedDataStatus(input: {
  latestObservation: Date | null;
  attemptedAt: Date;
  processedCount: number;
  maxAgeDays?: number;
}): "CURRENT" | "STALE" | "ERROR" {
  if (input.processedCount <= 0) return "ERROR";
  const observedAt = input.latestObservation;
  if (!observedAt || Number.isNaN(observedAt.getTime())) return "STALE";

  const ageMs = input.attemptedAt.getTime() - observedAt.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const maxAgeMs = (input.maxAgeDays ?? 14) * oneDayMs;
  return ageMs >= -oneDayMs && ageMs <= maxAgeMs ? "CURRENT" : "STALE";
}
