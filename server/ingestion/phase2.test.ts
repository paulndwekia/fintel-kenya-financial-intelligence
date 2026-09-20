import { describe, expect, it } from "vitest";
import { extractTreasuryBondDocumentLinks, missingWeekdayCount, parseHistoricalFxCsv, parseHistoricalTreasuryBillHtml, parseTreasuryBondResultText } from "./phase2";

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

describe("FINTEL Phase 2 ingestion parsers", () => {
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
