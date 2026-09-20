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

export function treasuryBillObservationKey(tenorDays: number, auctionDate: Date): string {
  return `${tenorDays}|${observationDayKey(auctionDate)}`;
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
  return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062 || (typeof candidate.message === "string" && /duplicate entry|duplicate key/i.test(candidate.message));
}
