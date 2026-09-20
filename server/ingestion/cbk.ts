import axios from "axios";

export const CBK_URLS = {
  forex: "https://www.centralbank.go.ke/forex/",
  treasuryBills: "https://www.centralbank.go.ke/bills-bonds/treasury-bills/",
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
  auctionDate: Date;
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
  return value.replace(/&nbsp;/gi, " ").replace(/&#8217;|&#x27;/gi, "'").replace(/&#8211;|&ndash;/gi, "-").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/<[^>]+>/g, " ");
}

export function cleanText(html: string) {
  return decodeEntities(html).replace(/\s+/g, " ").trim();
}

export function parseDate(value: string): Date | null {
  const text = value.trim().replace(/(\d)(st|nd|rd|th)/gi, "$1").replace(/,/g, "");
  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slash) return new Date(Date.UTC(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1])));
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

export function parseCbkForexPage(html: string, sourceUrl = CBK_URLS.forex): { rates: RateObservation[]; keyRates: RateObservation[] } {
  const text = cleanText(html);
  const posted = parseDateFromText(text) ?? new Date();
  const rates: RateObservation[] = [];
  const keyRates: RateObservation[] = [];
  const fxMatches = [
    ["USD/KES", "US DOLLAR"],
    ["GBP/KES", "STG POUND"],
    ["EUR/KES", "EURO"],
  ] as const;
  for (const [pair, label] of fxMatches) {
    const match = text.match(new RegExp(`${label}\\s+([0-9]+(?:\\.[0-9]+)?)`, "i"));
    if (!match) continue;
    const value = Number(match[1]);
    rates.push({ instrument: pair, value, unit: "KES per currency", observationDate: posted, publicationTimestamp: posted, frequency: "DAILY", currency: "KES", sourceUrl, rawValue: match[0], validationStatus: validateRate(value, 0.01, 1000) ? "VALID" : "QUARANTINED" });
  }
  const keyMatches = [
    ["CBK_RATE", "Central Bank Rate"],
    ["KESONIA", "KESONIA"],
    ["CBK_DISCOUNT_WINDOW", "CBK Discount Window"],
    ["TBILL_91D", "91-Day T-Bill"],
  ] as const;
  for (const [instrument, label] of keyMatches) {
    const match = text.match(new RegExp(`${label.replace(/[/-]/g, "[\\/-]")}\\s+([0-9]+(?:\\.[0-9]+)?)%\\s*([0-9]{1,2}[\\/-][0-9]{1,2}[\\/-][0-9]{4})?`, "i"));
    if (!match) continue;
    const value = Number(match[1]);
    const date = match[2] ? parseDate(match[2]) : posted;
    if (!date) continue;
    keyRates.push({ instrument, value, unit: "%", observationDate: date, publicationTimestamp: posted, frequency: instrument === "KESONIA" ? "DAILY" : "AS_PUBLISHED", currency: "KES", sourceUrl, rawValue: match[0], validationStatus: validateRate(value) ? "VALID" : "QUARANTINED" });
  }
  return { rates, keyRates };
}

export function parseCbkTreasuryBillsPage(html: string, sourceUrl = CBK_URLS.treasuryBills): BillObservation[] {
  const text = cleanText(html);
  const observations: BillObservation[] = [];
  for (const tenorDays of [91, 182, 364]) {
    const pattern = new RegExp(`${tenorDays}-DAY\\s+Issue Number:\\s*([\\d\\/]+)\\s+Auction Date:\\s*([A-Za-z0-9 ,]+?)\\s+Value Dated:\\s*([A-Za-z0-9 ,]+?)\\s+Previous Average Interest Rate:\\s*([0-9]+(?:\\.[0-9]+)?)\\s*%`, "i");
    const match = text.match(pattern);
    if (!match) continue;
    const auctionDate = parseDate(match[2]);
    const rate = Number(match[4]);
    observations.push({ tenorDays, auctionDate: auctionDate ?? new Date(0), weightedAverageRate: rate, sourceUrl, rawValue: match[0], validationStatus: auctionDate && validateRate(rate) ? "VALID" : "QUARANTINED" });
  }
  return observations;
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
  const [forexHtml, billsHtml] = await Promise.all([fetchWithRetry(CBK_URLS.forex), fetchWithRetry(CBK_URLS.treasuryBills)]);
  const parsedForex = parseCbkForexPage(forexHtml);
  const treasuryBills = parseCbkTreasuryBillsPage(billsHtml);
  const yieldCurve = treasuryBills.filter((bill) => bill.validationStatus === "VALID").map((bill) => ({ tenor: `${bill.tenorDays}D`, maturityYears: bill.tenorDays / 365, yieldRate: bill.weightedAverageRate, sourceUrl: bill.sourceUrl, observationDate: bill.auctionDate, rawValue: bill.rawValue, validationStatus: bill.validationStatus }));
  return {
    retrievedAt,
    marketRates: parsedForex.keyRates,
    fxRates: parsedForex.rates.map((rate) => ({ ...rate, pair: rate.instrument })),
    treasuryBills,
    bonds: { status: "DATA REQUIRED", sourceUrl: CBK_URLS.treasuryBonds, reason: "Official CBK Treasury Bond results require parsing the linked auction-result/prospectus material; no bond records are inserted until that parser is validated." },
    yieldCurve,
    sources: [
      { name: "CBK key rates and FX", sourceType: "official HTML", endpoint: CBK_URLS.forex, status: parsedForex.keyRates.length || parsedForex.rates.length ? "CURRENT" : "ERROR" },
      { name: "CBK Treasury Bills", sourceType: "official HTML", endpoint: CBK_URLS.treasuryBills, status: treasuryBills.length ? "CURRENT" : "ERROR" },
      { name: "CBK Treasury Bonds", sourceType: "official page / linked files", endpoint: CBK_URLS.treasuryBonds, status: "DATA REQUIRED" },
      { name: "CBK yield curve observations", sourceType: "official page + bill observations", endpoint: CBK_URLS.financialMarkets, status: yieldCurve.length ? "CURRENT" : "DATA REQUIRED" },
    ],
  };
}
