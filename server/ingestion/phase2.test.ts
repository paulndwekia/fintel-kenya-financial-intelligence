import { describe, expect, it } from "vitest";
import { normalizePdfFetchUrl, extractTreasuryBillResultLinks, extractTreasuryBondDocumentLinks, missingWeekdayCount, parseHistoricalFxCsv, parseHistoricalTreasuryBillHtml, parseTreasuryBillResultText, parseTreasuryBondResultText } from "./phase2";

const bondText = `RESULTS FOR REOPENED FIFTEEN AND THIRTY YEARS TREASURY BONDS ISSUE NOs. FXD3/2019/015 AND SDB1/2011/030 DATED 07/09/2026
ISSUE NUMBER FXD3/2019/015 SDB1/2011/030
TENOR Fifteen (7.9 years to maturity) Thirty (14.4 years to maturity)
ISIN KE6000001328 KE2000002135
Due Dates 10-Jul-34 21-Jan-41
Total Amount Offered (Kshs. M) 60,000.00
Total bids Received at cost (Kshs. M) 57,101.40 11,093.49
Amount Accepted (Kshs. M) 41,139.13 6,609.37
Market Weighted Average Rate (%) 12.8290 13.7991
Weighted Average Rate of Accepted Bids (%) 12.7631 13.6937
Price per Kshs 100 at average yield 99.5615 90.3598
Coupon Rate (%) 12.3400 12.0000`;

const billResultText = `A. RESULTS OF 91, 182 & 364 DAYS TREASURY BILLS ISSUES 2707/091, 2681/182 & 2636/364 DATED 09/11/2026
Market Weighted Average Interest Rate 8.7501% 8.8498% 9.0314%
Weighted Average Interest Rate of accepted bids 8.7500% 8.8450% 9.0282%
Price per Kshs 100 at average interest rate 97.8651 95.7759 91.7402
C. NEXT TREASURY BILLS AUCTIONS: ISSUE NOS. 2708/091, 2682/182 & 2637/364 DATED 16/11/2026`;

describe("FINTEL Phase 2 ingestion parsers", () => {
  it("does not double-encode already escaped CBK PDF paths", () => {
    expect(normalizePdfFetchUrl("https://www.centralbank.go.ke/results/RESULTS%20DATED%2009-11-2026.pdf"))
      .toBe("https://www.centralbank.go.ke/results/RESULTS%20DATED%2009-11-2026.pdf");
    expect(normalizePdfFetchUrl("https://www.centralbank.go.ke/results/RESULTS DATED 09-11-2026.pdf"))
      .toBe("https://www.centralbank.go.ke/results/RESULTS%20DATED%2009-11-2026.pdf");
  });


  it("reads bond table values placed below labels and keeps accepted-bid yields as YTM", () => {
    const splitText = [
      "RESULTS FOR REOPENED FIFTEEN AND THIRTY YEAR TREASURY BOND ISSUE Nos. FXD3/2019/015 AND FXD1/2026/030 DATED 09/11/2026",
      "ISSUE NUMBER", "FXD3/2019/015", "FXD1/2026/030",
      "TENOR", "Fifteen (7.8 years to maturity)", "Thirty (29.5 years to maturity)",
      "ISIN", "KE6000001328", "KE8000006760", "Due Dates", "10-Jul-34", "13-Mar-56",
      "Total Amount Offered (Kshs. M)", "50,000.00",
      "Total bids Received at cost (Kshs. M)", "37,069.54", "62,397.80",
      "Amount Accepted (Kshs. M)", "29,904.78", "40,954.62",
      "Market Weighted Average Rate (%)", "12.8717", "14.1711",
      "Weighted Average Rate of Accepted Bids (%)", "12.7404", "14.1266",
      "Price per Kshs 100 at average yield", "101.8243", "89.3921",
      "Coupon Rate (%)", "12.3400", "12.5000"
    ].join("\n");
    const rows = parseTreasuryBondResultText(splitText, "https://www.centralbank.go.ke/latest-bond.pdf");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.maturityDate?.toISOString().slice(0, 10))).toEqual(["2034-07-10", "2056-03-13"]);
    expect(rows.map((row) => row.validationStatus)).toEqual(["VALID", "VALID"]);
    expect(rows.map((row) => row.weightedAverageYield)).toEqual([12.8717, 14.1711]);
    expect(rows.map((row) => row.yieldToMaturity)).toEqual([12.7404, 14.1266]);
  });


  it("extracts validated bond terms and preserves source document lineage", () => {
    const rows = parseTreasuryBondResultText(bondText, "https://www.centralbank.go.ke/bond.pdf", new Date("2026-09-08T00:00:00Z"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.securityCode).toBe("FXD3/2019/015");
    expect(rows[0]?.isin).toBe("KE6000001328");
    expect(rows[0]?.couponRate).toBe(12.34);
    expect(rows[0]?.weightedAverageYield).toBe(12.829);
    expect(rows[0]?.validationStatus).toBe("VALID");
    expect(rows[0]?.documentUrl).toContain("bond.pdf");
    expect(rows[0]?.duplicateKey).toContain("FXD3/2019/015");
  });

  it("extracts official CBK bond PDF links without fabricating records", () => {
    const links = extractTreasuryBondDocumentLinks('<a href="https://www.centralbank.go.ke/uploads/historical_treasury_bond_results/1_RESULT.pdf">RESULT</a>');
    expect(links).toEqual([{ url: "https://www.centralbank.go.ke/uploads/historical_treasury_bond_results/1_RESULT.pdf", label: "RESULT" }]);
  });


  it("extracts CBK Bill PDF links with reordered attributes and relative paths", () => {
    const links = extractTreasuryBillResultLinks('<a class="result-link" title="Auction result" href="/uploads/91_day_historical_treasury_bill_results/one%20result.pdf"> <strong>RESULTS 2707</strong> </a>');
    expect(links).toEqual([{ url: "https://www.centralbank.go.ke/uploads/91_day_historical_treasury_bill_results/one%20result.pdf", label: "RESULTS 2707" }]);
  });

  it("uses dated accepted-bid Treasury Bill yields from the auction result, not the next auction", () => {
    const rows = parseTreasuryBillResultText(billResultText, "https://www.centralbank.go.ke/bills-results.pdf", new Date("2026-11-10T00:00:00Z"));
    expect(rows.map((row) => row.tenorDays)).toEqual([91, 182, 364]);
    expect(rows.map((row) => row.weightedAverageRate)).toEqual([8.75, 8.845, 9.0282]);
    expect(rows.every((row) => row.issueDate.toISOString().startsWith("2026-11-09"))).toBe(true);
    expect(rows.every((row) => row.validationStatus === "VALID")).toBe(true);
  });

  it("parses authoritative FX CSV and quarantines invalid rows", () => {
    const parsed = parseHistoricalFxCsv("01/01/2020,US DOLLAR,101.2,100,102\n2020-01-02,\"EURO\",112.3,111,113\ninvalid,row", "https://cbk.example/fx.csv");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.instrument).toBe("USD/KES");
    expect(parsed.rejected).toHaveLength(1);
  });

  it("parses historical Treasury Bill rows and detects weekday gaps", () => {
    const parsed = parseHistoricalTreasuryBillHtml(`<table><tr><td>2020-01-06</td><td>1</td><td>91</td><td></td><td></td><td>7.1</td></tr><tr><td>2020-01-08</td><td>2</td><td>91</td><td></td><td></td><td>7.2</td></tr></table>`, "https://cbk.example/bills");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.instrument).toBe("TBILL_91D");
    expect(missingWeekdayCount(parsed.rows)).toBe(1);
  });
});
