import { PDFParse } from "pdf-parse";
import { CBK_URLS, cleanText, fetchWithRetry, parseDate } from "./cbk";

export type BondValidationStatus = "VALID" | "QUARANTINED" | "ERROR";
export type BondObservation = {
  securityCode: string;
  isin: string | null;
  auctionDate: Date | null;
  issueDate: Date | null;
  maturityDate: Date | null;
  tenorYears: number | null;
  couponRate: number | null;
  couponFrequency: string | null;
  pricePer100: number | null;
  weightedAverageYield: number | null;
  cutOffYield: number | null;
  faceValueKes: number | null;
  amountOfferedKes: number | null;
  bidsReceivedKes: number | null;
  bidsAcceptedKes: number | null;
  amountAcceptedKes: number | null;
  yieldToMaturity: number | null;
  documentUrl: string;
  sourceUrl: string;
  observationDate: Date | null;
  retrievalTimestamp: Date;
  frequency: string;
  currency: string;
  rawValue: string;
  duplicateKey: string;
  validationStatus: BondValidationStatus;
  reviewReason: string | null;
};

export type HistoricalObservation = {
  instrument: string;
  value: number;
  observationDate: Date;
  sourceUrl: string;
  retrievalTimestamp: Date;
  frequency: string;
  currency: string;
  rawValue: string;
  quality: "VALIDATED" | "QUARANTINED";
  reviewReason?: string | null;
};

function numbers(line: string) {
  return Array.from(line.matchAll(/-?\d+(?:,\d{3})*(?:\.\d+)?/g)).map((match) => Number(match[0].replace(/,/g, ""))).filter(Number.isFinite);
}
function dates(line: string) {
  return Array.from(line.matchAll(/\b\d{1,2}(?:[\/\-]\d{1,2}[\/\-]\d{2,4}|[\-][A-Za-z]{3}[\-]\d{2,4})\b/g)).map((match) => parseDate(match[0])).filter((date): date is Date => Boolean(date));
}
function lineValue(text: string, label: string) {
  const line = text.split(/\r?\n/).find((value) => value.trim().toLowerCase().startsWith(label.toLowerCase()));
  return line ? line.trim() : "";
}
function extractIssueCodes(text: string) {
  const header = text.match(/ISSUE NOs?\.?\s+(.+?)\s+D(?:ATED|ue)/i)?.[1] ?? text.slice(0, 500);
  return Array.from(header.matchAll(/\b[A-Z]{2,5}\d?[\/-]\d{4}[\/-]\d{1,3}\b/g)).map((match) => match[0].replace(/-/g, "/"));
}
function validateBond(row: Omit<BondObservation, "validationStatus" | "reviewReason">) {
  const issues: string[] = [];
  if (!row.securityCode) issues.push("missing security identifier");
  if (!row.auctionDate) issues.push("missing auction date");
  if (!row.maturityDate) issues.push("missing maturity date");
  if (row.auctionDate && row.maturityDate && row.maturityDate <= row.auctionDate) issues.push("maturity date is not after auction date");
  for (const [label, value] of [["coupon", row.couponRate], ["weighted yield", row.weightedAverageYield], ["cut-off yield", row.cutOffYield]] as const) if (value !== null && (value < 0 || value > 100)) issues.push(`${label} outside 0-100% range`);
  if (row.amountAcceptedKes !== null && row.bidsReceivedKes !== null && row.amountAcceptedKes > row.bidsReceivedKes) issues.push("accepted amount exceeds bids received");
  if (row.amountOfferedKes !== null && row.amountAcceptedKes !== null && row.amountAcceptedKes > row.amountOfferedKes * 1.0001) issues.push("accepted amount exceeds amount offered");
  return issues;
}
function nth(values: number[], index: number) { return values.length === 1 ? values[0] : values[index] ?? null; }

export function parseTreasuryBondResultText(text: string, documentUrl: string, retrievalTimestamp = new Date()): BondObservation[] {
  const normalized = text.replace(/\u00a0/g, " ");
  const issueCodes = extractIssueCodes(normalized);
  const auctionDate = dates(normalized.match(/DATED[^\n]{0,80}/i)?.[0] ?? normalized.slice(0, 250))[0] ?? null;
  const isinValues = Array.from(normalized.matchAll(/\b[A-Z]{2}\d{10}\b/g)).map((match) => match[0]);
  const tenorValues = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)\s+years?\s+to maturity/gi)).map((match) => Number(match[1]));
  const maturityValues = dates(lineValue(normalized, "Due Dates"));
  const priceValues = numbers(lineValue(normalized, "Price per Kshs 100"));
  const weightedValues = numbers(lineValue(normalized, "Market Weighted Average Rate"));
  const acceptedYieldValues = numbers(lineValue(normalized, "Weighted Average Rate of Accepted Bids"));
  const cutOffValues = numbers(lineValue(normalized, "Cut-off Yield"));
  const couponValues = numbers(lineValue(normalized, "Coupon Rate"));
  const offeredValues = numbers(lineValue(normalized, "Total Amount Offered"));
  const bidsReceivedValues = numbers(lineValue(normalized, "Total bids Received"));
  const acceptedValues = numbers(lineValue(normalized, "Amount Accepted"));
  const issues = issueCodes.length ? issueCodes : ["UNIDENTIFIED_BOND"];
  return issues.map((securityCode, index) => {
    const maturityDate = maturityValues[index] ?? (maturityValues.length === 1 ? maturityValues[0] : null);
    const weightedAverageYield = nth(weightedValues, index);
    const row = {
      securityCode,
      isin: isinValues[index] ?? (isinValues.length === 1 ? isinValues[0] : null),
      auctionDate,
      issueDate: null,
      maturityDate,
      tenorYears: nth(tenorValues, index),
      couponRate: nth(couponValues, index),
      couponFrequency: null,
      pricePer100: nth(priceValues, index),
      weightedAverageYield,
      cutOffYield: nth(cutOffValues, index),
      faceValueKes: null,
      amountOfferedKes: nth(offeredValues, index) === null ? null : Number(nth(offeredValues, index)) * 1_000_000,
      bidsReceivedKes: nth(bidsReceivedValues, index) === null ? null : Number(nth(bidsReceivedValues, index)) * 1_000_000,
      bidsAcceptedKes: nth(acceptedValues, index) === null ? null : Number(nth(acceptedValues, index)) * 1_000_000,
      amountAcceptedKes: nth(acceptedValues, index) === null ? null : Number(nth(acceptedValues, index)) * 1_000_000,
      yieldToMaturity: weightedAverageYield ?? nth(acceptedYieldValues, index),
      documentUrl,
      sourceUrl: CBK_URLS.treasuryBonds,
      observationDate: auctionDate,
      retrievalTimestamp,
      frequency: "AUCTION",
      currency: "KES",
      rawValue: normalized.slice(0, 12000),
      duplicateKey: `${securityCode}|${auctionDate?.toISOString().slice(0, 10) ?? "UNKNOWN"}`,
    };
    const issuesFound = validateBond(row);
    return { ...row, validationStatus: issuesFound.length ? "QUARANTINED" as const : "VALID" as const, reviewReason: issuesFound.length ? issuesFound.join("; ") : null };
  });
}

function decodeHref(value: string) { return value.replace(/&amp;/g, "&").replace(/&#038;/g, "&").replace(/\\/g, ""); }
export function extractTreasuryBondDocumentLinks(html: string) {
  const links: Array<{ url: string; label: string }> = [];
  const pattern = /<a\s+href="([^"]*historical_treasury_bond_results[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;
  for (const match of Array.from(html.matchAll(pattern))) links.push({ url: decodeHref(match[1].replace("https://www.centralbank.go.ke//", "https://www.centralbank.go.ke/")), label: cleanText(match[2]) });
  return links;
}

async function fetchPdfBuffer(url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(encodeURI(url), { signal: controller.signal, cache: "no-store", headers: { "user-agent": "FINTEL-CBK-Ingestion/1.0", accept: "application/pdf" } });
      if (!response.ok) throw new Error(`CBK PDF returned HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("CBK PDF request failed");
}

export async function fetchTreasuryBondDocuments(options: { maxDocuments?: number; sourceHtml?: string } = {}) {
  const retrievalTimestamp = new Date();
  const html = options.sourceHtml ?? await fetchWithRetry(CBK_URLS.treasuryBonds);
  const links = extractTreasuryBondDocumentLinks(html).slice(0, options.maxDocuments ?? 5);
  const records: BondObservation[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  for (const link of links) {
    try {
      const parser = new PDFParse({ data: await fetchPdfBuffer(link.url) });
      const result = await parser.getText();
      await parser.destroy();
      records.push(...parseTreasuryBondResultText(result.text, link.url, retrievalTimestamp));
    } catch (error) {
      errors.push({ url: link.url, error: error instanceof Error ? error.message : "PDF parse failed" });
    }
  }
  return { records, errors, links, retrievedAt: retrievalTimestamp };
}

function csvDate(value: string) {
  const normalized = value.trim().replace(/^"|"$/g, "");
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))) : null;
}
export function parseHistoricalFxCsv(csv: string, sourceUrl: string, options: { limit?: number; from?: Date } = {}) {
  const retrievalTimestamp = new Date();
  const rows: HistoricalObservation[] = [];
  const rejected: Array<{ rawValue: string; reason: string }> = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split(",").map((field) => field.trim().replace(/^"|"$/g, ""));
    const date = csvDate(fields[0] ?? "");
    const value = Number(fields[2]);
    if (!date || !fields[1] || !Number.isFinite(value) || value <= 0) { rejected.push({ rawValue: line, reason: "invalid date, currency, or mean rate" }); continue; }
    if (options.from && date < options.from) continue;
    rows.push({ instrument: fields[1] === "US DOLLAR" ? "USD/KES" : fields[1], value, observationDate: date, sourceUrl, retrievalTimestamp, frequency: "DAILY", currency: "KES", rawValue: line, quality: "VALIDATED" });
    if (options.limit && rows.length >= options.limit) break;
  }
  return { rows, rejected, retrievedAt: retrievalTimestamp };
}

export function parseHistoricalTreasuryBillHtml(html: string, sourceUrl: string, options: { limit?: number } = {}) {
  const retrievalTimestamp = new Date();
  const rows: HistoricalObservation[] = [];
  const rejected: Array<{ rawValue: string; reason: string }> = [];
  for (const match of Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))) {
    const cells = Array.from(match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cleanText(cell[1]));
    if (cells.length < 6 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0] ?? "")) continue;
    const date = parseDate(cells[0]);
    const tenor = Number(cells[2]);
    const rate = Number(cells[5]);
    if (!date || ![91, 182, 364].includes(tenor) || !Number.isFinite(rate) || rate < 0 || rate > 100) { rejected.push({ rawValue: cells.join(" | "), reason: "invalid bill date, tenor, or rate" }); continue; }
    rows.push({ instrument: `TBILL_${tenor}D`, value: rate, observationDate: date, sourceUrl, retrievalTimestamp, frequency: "AUCTION", currency: "KES", rawValue: cells.join(" | "), quality: "VALIDATED" });
    if (options.limit && rows.length >= options.limit) break;
  }
  return { rows, rejected, retrievedAt: retrievalTimestamp };
}

export function missingWeekdayCount(rows: HistoricalObservation[]) {
  const byInstrument = new Map<string, Set<string>>();
  for (const row of rows) { const key = row.observationDate.toISOString().slice(0, 10); if (!byInstrument.has(row.instrument)) byInstrument.set(row.instrument, new Set()); byInstrument.get(row.instrument)!.add(key); }
  let missing = 0;
  for (const [instrument, datesSet] of Array.from(byInstrument.entries())) {
    const datesList = Array.from(datesSet).sort(); if (datesList.length < 2) continue;
    const cursor = new Date(`${datesList[0]}T00:00:00Z`); const end = new Date(`${datesList[datesList.length - 1]}T00:00:00Z`);
    while (cursor <= end) { const weekday = cursor.getUTCDay(); if (weekday > 0 && weekday < 6 && !datesSet.has(cursor.toISOString().slice(0, 10))) missing++; cursor.setUTCDate(cursor.getUTCDate() + 1); }
    void instrument;
  }
  return missing;
}
