import { PDFParse } from "pdf-parse";
import { CBK_URLS, cleanText, fetchWithRetry, parseDate, type BillObservation } from "./cbk";

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
function dates(line: string, referenceDate?: Date) {
  return Array.from(line.matchAll(/\b\d{1,2}(?:[\/\-]\d{1,2}[\/\-]\d{2,4}|[\-][A-Za-z]{3}[\-]\d{2,4})\b/g))
    .map((match) => {
      const value = match[0];
      const shortYear = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
      if (shortYear && referenceDate) {
        const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(shortYear[2].toLowerCase());
        const day = Number(shortYear[1]);
        const yearSuffix = Number(shortYear[3]);
        if (month >= 0 && day >= 1 && day <= 31) {
          const futureYears = [1900 + yearSuffix, 2000 + yearSuffix, 2100 + yearSuffix]
            .filter((year) => Date.UTC(year, month, day) > referenceDate.getTime());
          if (futureYears.length) return new Date(Date.UTC(Math.min(...futureYears), month, day));
        }
      }
      return parseDate(value);
    })
    .filter((date): date is Date => Boolean(date));
}
const BOND_RESULT_ROW_LABELS = [
  /ISSUE\s+NUMBER/i, /TENOR\b/i, /ISIN\b/i, /DUE\s+DATES/i,
  /TOTAL\s+AMOUNT\s+OFFERED/i, /TOTAL\s+BIDS\s+RECEIVED/i,
  /PERFORMANCE\s+RATE/i, /AMOUNT\s+ACCEPTED/i, /OF\s+WHICH/i,
  /BID[\s-]*TO[\s-]*COVER\s+RATIO/i, /MARKET\s+WEIGHTED\s+AVERAGE\s+RATE/i,
  /WEIGHTED\s+AVERAGE\s+RATE\s+OF\s+ACCEPTED\s+BIDS/i,
  /CUT[\s-]*OFF\s+YIELD/i,
  /PRICE\s+PER\s+KSHS\s+100/i, /COUPON\s+RATE/i,
  /PURPOSE\s*\/\s*APPLICATION/i, /REDEMPTIONS/i, /NEW\s+BORROWING/i,
];

/** Read a table row even when PDF extraction places its values on later lines. */
function fieldBlock(text: string, label: RegExp): string {
  const match = label.exec(text);
  if (!match) return "";
  const tail = text.slice(match.index + match[0].length);
  const nextLabels = BOND_RESULT_ROW_LABELS
    .filter((candidate) => candidate.source !== label.source)
    .map((candidate) => candidate.exec(tail)?.index ?? -1)
    .filter((index) => index >= 0);
  const end = nextLabels.length ? Math.min(...nextLabels) : Math.min(tail.length, 800);
  return tail.slice(0, end);
}

function extractIssueCodes(text: string) {
  const headingEnd = text.search(/\bDATED\b/i);
  const header = headingEnd >= 0 ? text.slice(0, headingEnd) : text.slice(0, 1000);
  const matches = Array.from(header.matchAll(/\b[A-Z]{2,5}\d?[\/-]\d{4}[\/-]\d{1,3}\b/g))
    .map((match) => match[0].replace(/-/g, "/"));
  // CBK PDFs can repeat the issue numbers in both the table and its title.
  // Keep each security once, in the order in which it first appears.
  return Array.from(new Set(matches));
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

function valueForBondIssue<T>(values: T[], index: number, issueCount: number): T | null {
  if (issueCount === 1) return values[0] ?? null;
  return values.length === issueCount ? values[index] ?? null : null;
}

export function assessBondBatchFreshness(
  records: Array<Pick<BondObservation, "validationStatus" | "observationDate" | "documentUrl">>,
  attemptedAt: Date,
) {
  const datedRecords = records.filter((row) => row.observationDate);
  const latestBatchDate = datedRecords
    .map((row) => row.observationDate as Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const validRecords = records.filter((row) => row.validationStatus === "VALID" && row.observationDate);
  const latestValidDate = validRecords
    .map((row) => row.observationDate as Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const latestValidDocuments = new Set(validRecords
    .filter((row) => row.observationDate?.getTime() === latestValidDate?.getTime())
    .map((row) => row.documentUrl));
  const rejected = records.filter((row) => row.validationStatus !== "VALID");
  const latestAuctionRejected = rejected.filter((row) =>
    row.observationDate?.getTime() === latestBatchDate?.getTime() ||
    (!row.observationDate && latestValidDocuments.has(row.documentUrl))
  ).length;
  const olderRejected = rejected.length - latestAuctionRejected;
  const ageMs = latestValidDate ? attemptedAt.getTime() - latestValidDate.getTime() : Number.POSITIVE_INFINITY;
  const fresh = ageMs >= -24 * 60 * 60 * 1000 && ageMs <= 14 * 24 * 60 * 60 * 1000;
  const newestDateIsValid = Boolean(latestBatchDate && latestValidDate && latestBatchDate.getTime() === latestValidDate.getTime());
  return {
    current: fresh && newestDateIsValid && latestAuctionRejected === 0,
    latestObservation: latestValidDate,
    latestAuctionRejected,
    olderRejected,
  };
}

export function parseTreasuryBondResultText(text: string, documentUrl: string, retrievalTimestamp = new Date()): BondObservation[] {
  const normalized = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const issueCodes = extractIssueCodes(normalized);
  const auctionDateMatch = normalized.match(/\bDATED\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  const auctionDate = auctionDateMatch ? parseDate(auctionDateMatch[1]) : dates(normalized.slice(0, 700))[0] ?? null;
  const isinValues = Array.from(fieldBlock(normalized, /\bISIN\b/i).matchAll(/\b[A-Z]{2}\d{10}\b/g)).map((match) => match[0]);
  const tenorValues = Array.from(fieldBlock(normalized, /\bTENOR\b/i).matchAll(/(\d+(?:\.\d+)?)\s+years?\s+to maturity/gi)).map((match) => Number(match[1]));
  const maturityValues = dates(fieldBlock(normalized, /\bDUE\s+DATES\b/i), auctionDate ?? undefined);
  const priceValues = numbers(fieldBlock(normalized, /PRICE\s+PER\s+KSHS\s+100/i));
  const weightedValues = numbers(fieldBlock(normalized, /MARKET\s+WEIGHTED\s+AVERAGE\s+RATE/i));
  const acceptedYieldValues = numbers(fieldBlock(normalized, /WEIGHTED\s+AVERAGE\s+RATE\s+OF\s+ACCEPTED\s+BIDS/i));
  const cutOffValues = numbers(fieldBlock(normalized, /CUT[\s-]*OFF\s+YIELD/i));
  const couponValues = numbers(fieldBlock(normalized, /COUPON\s+RATE/i));
  const offeredValues = numbers(fieldBlock(normalized, /TOTAL\s+AMOUNT\s+OFFERED/i));
  const bidsReceivedValues = numbers(fieldBlock(normalized, /TOTAL\s+BIDS\s+RECEIVED/i));
  const acceptedValues = numbers(fieldBlock(normalized, /AMOUNT\s+ACCEPTED/i));
  const issues = issueCodes.length ? issueCodes : ["UNIDENTIFIED_BOND"];

  return issues.map((securityCode, index) => {
    const maturityDate = valueForBondIssue(maturityValues, index, issues.length);
    const weightedAverageYield = valueForBondIssue(weightedValues, index, issues.length);
    const acceptedBidYield = valueForBondIssue(acceptedYieldValues, index, issues.length);
    const amountOffered = valueForBondIssue(offeredValues, index, issues.length);
    const bidsReceived = valueForBondIssue(bidsReceivedValues, index, issues.length);
    const amountAccepted = valueForBondIssue(acceptedValues, index, issues.length);
    const row = {
      securityCode,
      isin: valueForBondIssue(isinValues, index, issues.length),
      auctionDate,
      issueDate: null,
      maturityDate,
      tenorYears: valueForBondIssue(tenorValues, index, issues.length),
      couponRate: valueForBondIssue(couponValues, index, issues.length),
      couponFrequency: null,
      pricePer100: valueForBondIssue(priceValues, index, issues.length),
      weightedAverageYield,
      cutOffYield: valueForBondIssue(cutOffValues, index, issues.length),
      faceValueKes: null,
      amountOfferedKes: amountOffered === null ? null : amountOffered * 1_000_000,
      bidsReceivedKes: bidsReceived === null ? null : bidsReceived * 1_000_000,
      bidsAcceptedKes: amountAccepted === null ? null : amountAccepted * 1_000_000,
      amountAcceptedKes: amountAccepted === null ? null : amountAccepted * 1_000_000,
      yieldToMaturity: acceptedBidYield ?? weightedAverageYield,
      documentUrl,
      sourceUrl: CBK_URLS.treasuryBonds,
      observationDate: auctionDate,
      retrievalTimestamp,
      frequency: "AUCTION",
      currency: "KES",
      rawValue: normalized.slice(0, 12000),
      duplicateKey: securityCode + "|" + (auctionDate?.toISOString().slice(0, 10) ?? "UNKNOWN"),
    };
    const issuesFound = validateBond(row);
    return {
      ...row,
      validationStatus: issuesFound.length ? "QUARANTINED" as const : "VALID" as const,
      reviewReason: issuesFound.length ? issuesFound.join("; ") : null,
    };
  });
}

function decodeHref(value: string) { return value.replace(/&amp;/g, "&").replace(/&#038;/g, "&").replace(/\\/g, ""); }
export function extractTreasuryBondDocumentLinks(html: string) {
  const links: Array<{ url: string; label: string }> = [];
  const seen = new Set<string>();
  for (const match of Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi))) {
    const hrefMatch = match[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    if (!href) continue;
    let url: string;
    try { url = new URL(decodeHref(href), CBK_URLS.treasuryBonds).toString(); } catch { continue; }
    if (!/historical_treasury_bond_results/i.test(url) || !/\.pdf(?:[?#]|$)/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    links.push({ url, label: cleanText(match[2]) });
  }
  return links;
}

export function normalizePdfFetchUrl(url: string) {
  const normalized = new URL(url);
  if (normalized.protocol !== "https:") throw new Error("CBK PDF links must use HTTPS.");
  // CBK sometimes publishes attachment links with //uploads after the host.
  normalized.pathname = normalized.pathname.replace(/\/{2,}/g, "/");
  // URL.toString() encodes literal spaces once and preserves existing %20 escapes.
  return normalized.toString();
}

async function fetchPdfBuffer(url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(normalizePdfFetchUrl(url), {
        signal: controller.signal,
        cache: "no-store",
        headers: { "user-agent": "FINTEL-CBK-Ingestion/1.0", accept: "application/pdf" },
      });
      if (!response.ok) throw new Error("CBK PDF returned HTTP " + response.status);
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
  const links = extractTreasuryBondDocumentLinks(html).slice(0, options.maxDocuments ?? 8);
  const records: BondObservation[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  for (const link of links) {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: await fetchPdfBuffer(link.url) });
      const result = await parser.getText();
      const parsed = parseTreasuryBondResultText(result.text, link.url, retrievalTimestamp);
      if (!parsed.length) errors.push({ url: link.url, error: "PDF text did not contain a recognizable auction result." });
      records.push(...parsed);
    } catch (error) {
      errors.push({ url: link.url, error: error instanceof Error ? error.message : "PDF parse failed" });
    } finally {
      if (parser) await parser.destroy().catch(() => undefined);
    }
  }
  return { records, errors, links, retrievedAt: retrievalTimestamp };
}

/** Find the linked official auction-result PDFs on the CBK Treasury Bills page. */
export function extractTreasuryBillResultLinks(html: string) {
  const links: Array<{ url: string; label: string }> = [];
  const seen = new Set<string>();
  for (const match of Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi))) {
    const hrefMatch = match[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    if (!href) continue;
    let url: string;
    try { url = new URL(decodeHref(href), CBK_URLS.treasuryBills).toString(); } catch { continue; }
    if (!/historical_treasury_bill_results/i.test(url) || !/\.pdf(?:[?#]|$)/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    links.push({ url, label: cleanText(match[2]) });
  }
  return links;
}

/**
 * Read the latest CBK auction-result PDF and extract the weighted average
 * accepted-bid yields for the three bill tenors. The auction date comes from
 * the PDF's dated result heading, never from the next-auction announcement.
 */
export function parseTreasuryBillResultText(text: string, documentUrl: string, retrievalTimestamp = new Date()): BillObservation[] {
  // Normalize PDF text because headings and rate cells may be split over lines.
  const normalized = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  const dateMatch = normalized.match(/RESULTS[\s\S]{0,400}?DATED\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i);  const issueDate = dateMatch ? parseDate(dateMatch[1]) : null;
  const issueCodes = Array.from(normalized.matchAll(/\b\d{4}\s*\/\s*(091|182|364)\b/g))
    .slice(0, 3)
    .map((match) => Number(match[1]));
  const rateLabel = /Weighted Average Interest Rate of accepted bids/i.exec(normalized);
  if (!issueDate || issueCodes.length !== 3 || new Set(issueCodes).size !== 3) return [];

  const start = rateLabel ? rateLabel.index + rateLabel[0].length : -1;
  const priceStart = start >= 0 ? normalized.indexOf("Price per Kshs 100", start) : -1;
  const rateBlock = start >= 0
    ? normalized.slice(start, priceStart > start ? priceStart : start + 240)
    : "";
  const rates = Array.from(rateBlock.matchAll(/\b(\d{1,2}\.\d{2,5})\b/g))
    .map((match) => Number(match[1]))
    .slice(0, 3);
  if (rates.length !== 3 || rates.some((rate) => !Number.isFinite(rate) || rate <= 0 || rate > 100)) return [];

  return issueCodes.map((tenorDays, index) => ({
    tenorDays,
    issueDate,
    weightedAverageRate: rates[index],
    sourceUrl: documentUrl,
    rawValue: `CBK auction results dated ${issueDate.toISOString().slice(0, 10)} | ${tenorDays}D | accepted-bid weighted average ${rates[index]}%`,
    validationStatus: "VALID" as const,
  })).sort((a, b) => a.tenorDays - b.tenorDays);
}

const CBK_TBILL_BOOTSTRAP_DOCUMENTS = [
  // Official CBK auction result. Freshness validation rejects this once it is older than 14 days.
  "https://www.centralbank.go.ke/uploads/91_day_historical_treasury_bill_results/2027542524_RESULTS%202707-091%202681-182%202636-364%20DATED%2009-11-2026.pdf",
];

function attachmentLinksFromWordPress(payload: unknown): Array<{ url: string; label: string }> {
  if (!Array.isArray(payload)) return [];
  const links: Array<{ url: string; label: string }> = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const titleValue = record.title && typeof record.title === "object"
      ? (record.title as Record<string, unknown>).rendered
      : record.title;
    const label = typeof titleValue === "string" ? cleanText(titleValue) : String(record.slug ?? "CBK Treasury Bill result");
    const guid = record.guid && typeof record.guid === "object"
      ? (record.guid as Record<string, unknown>).rendered
      : record.guid;
    for (const candidate of [record.source_url, record.url, record.link, guid]) {
      if (typeof candidate !== "string" || !/\.pdf(?:[?#]|$)/i.test(candidate)) continue;
      let url: string;
      try { url = new URL(decodeHref(candidate), CBK_URLS.treasuryBills).toString(); } catch { continue; }
      if (/centralbank\.go\.ke/i.test(url)) links.push({ url, label });
    }
  }
  return links;
}

async function discoverTreasuryBillResultLinks(html: string, errors: Array<{ url: string; error: string }>) {
  const pageLinks = extractTreasuryBillResultLinks(html);
  if (pageLinks.length) return pageLinks;
  const origin = new URL(CBK_URLS.treasuryBills).origin;
  const endpoints = [
    origin + "/wp-json/wp/v2/media?search=2707-091&per_page=30&orderby=date&order=desc",
    origin + "/wp-json/wp/v2/media?search=treasury%20bills%20results&per_page=30&orderby=date&order=desc",
    origin + "/wp-json/wp/v2/search?search=treasury%20bill%20results&subtype=attachment&per_page=30",
  ];
  for (const endpoint of endpoints) {
    try {
      const payload = JSON.parse(await fetchWithRetry(endpoint, 2)) as unknown;
      const discovered = attachmentLinksFromWordPress(payload);
      if (discovered.length) return discovered;
    } catch (error) {
      errors.push({ url: endpoint, error: error instanceof Error ? error.message : "CBK document index lookup failed" });
    }
  }
  return [];
}

/** Return only a full, fresh, three-tenor CBK auction observation. */
export async function fetchTreasuryBillResultDocuments(options: { maxDocuments?: number; sourceHtml?: string } = {}) {
  const retrievalTimestamp = new Date();
  const html = options.sourceHtml ?? await fetchWithRetry(CBK_URLS.treasuryBills);
  const errors: Array<{ url: string; error: string }> = [];
  const discovered = await discoverTreasuryBillResultLinks(html, errors);
  const allLinks = [
    ...CBK_TBILL_BOOTSTRAP_DOCUMENTS.map((url) => ({ url, label: "Verified CBK result (freshness-gated)" })),
    ...discovered,
  ];
  const seen = new Set<string>();
  const links = allLinks.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  }).slice(0, options.maxDocuments ?? 12);

  for (const link of links) {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: await fetchPdfBuffer(link.url) });
      const result = await parser.getText();
      const records = parseTreasuryBillResultText(result.text, link.url, retrievalTimestamp);
      const freshRecords = records.filter((row) => {
        const age = retrievalTimestamp.getTime() - row.issueDate.getTime();
        return row.validationStatus === "VALID" && age >= -24 * 60 * 60 * 1000 && age <= 14 * 24 * 60 * 60 * 1000;
      });
      if (freshRecords.length === 3 && [91, 182, 364].every((tenor) => freshRecords.some((row) => row.tenorDays === tenor))) {
        return { records: freshRecords, errors, links, retrievedAt: retrievalTimestamp };
      }
      errors.push({ url: link.url, error: records.length ? "PDF contained no complete fresh 91/182/364-day tenor set." : "PDF text did not contain a complete recognizable Treasury Bill result." });
    } catch (error) {
      errors.push({ url: link.url, error: error instanceof Error ? error.message : "PDF parse failed" });
    } finally {
      if (parser) await parser.destroy().catch(() => undefined);
    }
  }
  return { records: [] as BillObservation[], errors, links, retrievedAt: retrievalTimestamp };
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
