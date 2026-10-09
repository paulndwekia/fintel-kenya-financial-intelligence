import axios from "axios";

export const CBK_URLS = {
  forex: "https://www.centralbank.go.ke/forex/",
  // The offer page reports the NEXT auction and repeats a previous average rate.
  // It must not be used as if that rate belonged to the future auction date.
  treasuryBills: "https://www.centralbank.go.ke/bills-bonds/treasury-bills/",
  treasuryBillAverageRates: "https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/",
  treasuryBonds: "https://www.centralbank.go.ke/bills-bonds/treasury-bonds/",
  financialMarkets: "https://www.centralbank.go.ke/financial-markets/",
} as const;

export type ValidationStatus = "VALID" | "ERROR" | "QUARANTINED";
export type RateObservation = {
  instrument: string;
  value: number;
  unit: string;
  observationDate: Date;
  publicationTimestamp: Date | null;
  frequency: string;
  currency: string;
  sourceUrl: string;
  rawValue: string;
  validationStatus: ValidationStatus;
};
export type BillObservation = {
  tenorDays: number;
  issueDate: Date;
  weightedAverageRate: number;
  sourceUrl: string;
  rawValue: string;
  validationStatus: ValidationStatus;
};
export type CbkBatch = {
  retrievedAt: Date;
  marketRates: RateObservation[];
  fxRates: Array<RateObservation & { pair: string }>;
  treasuryBills: BillObservation[];
  bonds: { status: "DATA REQUIRED"; sourceUrl: string; reason: string };
  yieldCurve: Array<{ tenor: string; maturityYears: number; yieldRate: number; sourceUrl: string; observationDate: Date; rawValue: string; validationStatus: ValidationStatus }>;
  sources: Array<{ name: string; sourceType: string; endpoint: string; status: "CURRENT" | "STALE" | "DATA REQUIRED" | "ERROR"; lastError?: string }>;
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8217;|&#x27;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, " ");
}

export function cleanText(html: string) {
  return decodeEntities(html).replace(/\s+/g, " ").trim();
}

export function parseDate(value: string): Date | null {
  const text = value.trim().replace(/(\d)(st|nd|rd|th)/gi, "$1").replace(/,/g, "");
  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slash) return new Date(Date.UTC(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1])));
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function validateRate(value: number, min = 0, max = 100) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function parseDateFromText(text: string) {
  const found = text.match(/(?:Posted On:\s*)?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
  return found ? parseDate(found[1]) : null;
}

function parsePostedOn(text: string) {
  const match = text.match(/Posted\s+On\s*:\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
  return match ? parseDate(match[1]) : null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionBefore(text: string, expressions: RegExp[]) {
  const positions = expressions.map((expression) => expression.exec(text)?.index ?? -1).filter((position) => position >= 0);
  return positions.length ? text.slice(0, Math.min(...positions)) : text;
}

export function parseCbkForexPage(html: string, sourceUrl = CBK_URLS.forex): { rates: RateObservation[]; keyRates: RateObservation[] } {
  const text = cleanText(html);

  // CBK's Forex page contains historical/archive tables before the latest daily
  // rates. Anchor to the LAST current-data heading; a first-match parser can
  // silently return an old USD/KES observation while labelling it current.
  const headingPattern = /Daily KES Exchange Rates/gi;
  const headings = Array.from(text.matchAll(headingPattern));
  const lastHeadingIndex = headings.length ? headings[headings.length - 1].index ?? 0 : -1;
  const afterLatestHeading = lastHeadingIndex >= 0 ? text.slice(lastHeadingIndex) : text;
  const quickLinksIndex = afterLatestHeading.search(/Quick\s*Links/i);
  const latestBlock = quickLinksIndex >= 0 ? afterLatestHeading.slice(0, quickLinksIndex) : afterLatestHeading;
  const posted = parsePostedOn(latestBlock);

  const fxText = sectionBefore(latestBlock, [/Posted\s+On\s*:/i, /Key\s+Rates/i]);
  const keyHeadingIndex = latestBlock.search(/Key\s+Rates/i);
  const keyText = keyHeadingIndex >= 0 ? latestBlock.slice(keyHeadingIndex) : "";
  const rates: RateObservation[] = [];
  const keyRates: RateObservation[] = [];
  const fxMatches = [
    ["USD/KES", "US DOLLAR"],
    ["GBP/KES", "STG POUND"],
    ["EUR/KES", "EURO"],
  ] as const;

  // Do not timestamp an undated FX number with the retrieval time. If the
  // published date is absent, only use a date found in the anchored FX block.
  const fxDate = posted ?? parseDateFromText(fxText);
  if (fxDate) {
    for (const [pair, label] of fxMatches) {
      const match = fxText.match(new RegExp(`${escapeRegex(label)}[\\s|:]+([0-9]+(?:\\.[0-9]+)?)`, "i"));
      if (!match) continue;
      const value = Number(match[1]);
      rates.push({ instrument: pair, value, unit: "KES per currency", observationDate: fxDate, publicationTimestamp: fxDate, frequency: "DAILY", currency: "KES", sourceUrl, rawValue: match[0], validationStatus: validateRate(value, 0.01, 1000) ? "VALID" : "QUARANTINED" });
    }
  }

  const keyMatches = [
    ["CBK_RATE", "Central Bank Rate"],
    ["KESONIA", "KESONIA"],
    ["CBK_DISCOUNT_WINDOW", "CBK Discount Window"],
    ["TBILL_91D", "91-Day T-Bill"],
  ] as const;
  for (const [instrument, label] of keyMatches) {
    const flexibleLabel = escapeRegex(label).replace(/-/g, "[-/]");
    const sourceDatePattern = "\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]+\\s+\\d{4}";
    // Support table text both with and without parentheses around the date.
    const match = keyText.match(new RegExp(`${flexibleLabel}[\\s|:]+([0-9]+(?:\\.[0-9]+)?)%\\s*\\(?\\s*(${sourceDatePattern})?\\s*\\)?`, "i"));
    if (!match) continue;
    const value = Number(match[1]);
    const date = match[2] ? parseDate(match[2]) : posted;
    if (!date) continue;
    // The CBK landing page may show the next 91-day bill cycle with a future
    // date. The dedicated average-rate table is the source for T-Bill history.
    // Never persist a future-dated key-rate tile as a current observation.
    if (posted && date.getTime() > posted.getTime()) continue;
    keyRates.push({ instrument, value, unit: "%", observationDate: date, publicationTimestamp: posted, frequency: instrument === "KESONIA" ? "DAILY" : "AS_PUBLISHED", currency: "KES", sourceUrl, rawValue: match[0], validationStatus: validateRate(value) ? "VALID" : "QUARANTINED" });
  }
  return { rates, keyRates };
}

/**
 * Parse the CBK Treasury Bills Average Rates table, not the “Bills on Offer”
 * page. The offer page shows the next auction date alongside a prior rate;
 * pairing those fields can create a future-dated historical observation.
 * This parser returns the newest valid source observation for each tenor.
 */
export function parseCbkTreasuryBillsPage(html: string, sourceUrl = CBK_URLS.treasuryBillAverageRates): BillObservation[] {
  const candidates = new Map<number, BillObservation>();
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));

  for (const rowMatch of rows) {
    const cells = Array.from(rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cleanText(cell[1]));
    if (cells.length < 6) continue;
    const issueDate = parseDate(cells[0] ?? "");
    const tenorDays = Number((cells[2] ?? "").replace(/[^0-9]/g, ""));
    const parseCandidateRate = (value: string | undefined) => {
      if (!value?.trim()) return null;
      const parsed = Number(value.trim().replace(/[% ,]/g, ""));
      return validateRate(parsed) && parsed > 0 ? parsed : null;
    };
    const weightedAverageRate = parseCandidateRate(cells[5]) ?? parseCandidateRate(cells[4]);
    if (!issueDate || ![91, 182, 364].includes(tenorDays) || weightedAverageRate === null) continue;

    const observation: BillObservation = {
      tenorDays,
      issueDate,
      weightedAverageRate,
      sourceUrl,
      rawValue: cells.slice(0, 6).join(" | "),
      validationStatus: "VALID",
    };
    const previous = candidates.get(tenorDays);
    if (!previous || observation.issueDate.getTime() > previous.issueDate.getTime()) candidates.set(tenorDays, observation);
  }

  return [91, 182, 364].map((tenor) => candidates.get(tenor)).filter((row): row is BillObservation => Boolean(row));
}

export function validateBatch(batch: Pick<CbkBatch, "marketRates" | "fxRates" | "treasuryBills">) {
  return {
    validMarketRates: batch.marketRates.filter((row) => row.validationStatus === "VALID"),
    validFxRates: batch.fxRates.filter((row) => row.validationStatus === "VALID"),
    validTreasuryBills: batch.treasuryBills.filter((row) => row.validationStatus === "VALID"),
    rejected: [...batch.marketRates, ...batch.fxRates, ...batch.treasuryBills].filter((row) => row.validationStatus !== "VALID"),
  };
}

export async function fetchWithRetry(url: string, attempts = 4): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await axios.get<string>(url, { timeout: 45000, responseType: "text", headers: { "user-agent": "FINTEL-CBK-Ingestion/1.0", accept: "text/html,text/csv,application/xhtml+xml", "cache-control": "no-cache" } });
      if (response.status < 200 || response.status >= 300) throw new Error(`CBK returned HTTP ${response.status}`);
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("CBK request failed");
}

export async function fetchCbkBatch(): Promise<CbkBatch> {
  const retrievedAt = new Date();
  const [forexHtml, billsHtml] = await Promise.all([
    fetchWithRetry(CBK_URLS.forex),
    fetchWithRetry(CBK_URLS.treasuryBillAverageRates),
  ]);
  const parsedForex = parseCbkForexPage(forexHtml);
  const treasuryBills = parseCbkTreasuryBillsPage(billsHtml);
  const fxValid = parsedForex.rates.filter((row) => row.validationStatus === "VALID");
  const keyRatesValid = parsedForex.keyRates.filter((row) => row.validationStatus === "VALID");
  const billValid = treasuryBills.filter((row) => row.validationStatus === "VALID");
  const expectedTenors = new Set(billValid.map((row) => row.tenorDays));
  const allBillTenorsPresent = [91, 182, 364].every((tenor) => expectedTenors.has(tenor));
  const fxComplete = ["USD/KES", "GBP/KES", "EUR/KES"].every((pair) => fxValid.some((row) => row.instrument === pair));
  const yieldCurve = billValid.map((bill) => ({ tenor: `${bill.tenorDays}D`, maturityYears: bill.tenorDays / 365, yieldRate: bill.weightedAverageRate, sourceUrl: bill.sourceUrl, observationDate: bill.issueDate, rawValue: bill.rawValue, validationStatus: bill.validationStatus }));
  return {
    retrievedAt,
    marketRates: parsedForex.keyRates,
    fxRates: parsedForex.rates.map((rate) => ({ ...rate, pair: rate.instrument })),
    treasuryBills,
    bonds: { status: "DATA REQUIRED", sourceUrl: CBK_URLS.treasuryBonds, reason: "Official CBK Treasury Bond results require parsing the linked auction-result/prospectus material; no bond records are inserted until that parser is validated." },
    yieldCurve,
    sources: [
      { name: "CBK key rates and FX", sourceType: "official HTML", endpoint: CBK_URLS.forex, status: fxComplete && keyRatesValid.length > 0 ? "CURRENT" : "ERROR", ...(fxComplete && keyRatesValid.length > 0 ? {} : { lastError: `Expected current FX rates for USD/KES, GBP/KES, EUR/KES and at least one validated key rate; parsed ${fxValid.length} FX and ${keyRatesValid.length} key rates.` }) },
      { name: "CBK Treasury Bills", sourceType: "official HTML average-rate table", endpoint: CBK_URLS.treasuryBillAverageRates, status: allBillTenorsPresent ? "CURRENT" : "ERROR", ...(allBillTenorsPresent ? {} : { lastError: `Expected latest valid 91, 182 and 364-day observations; parsed tenors: ${Array.from(expectedTenors).join(", ") || "none"}.` }) },
      { name: "CBK Treasury Bonds", sourceType: "official page / linked files", endpoint: CBK_URLS.treasuryBonds, status: "DATA REQUIRED", lastError: "Bond source parser remains a separately validated ingestion path." },
      { name: "CBK yield curve observations", sourceType: "official average-rate rows", endpoint: CBK_URLS.treasuryBillAverageRates, status: yieldCurve.length >= 3 ? "CURRENT" : "DATA REQUIRED" },
    ],
  };
}
