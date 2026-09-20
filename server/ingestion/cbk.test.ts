import { describe, expect, it } from "vitest";
import { parseCbkForexPage, parseCbkTreasuryBillsPage, validateBatch } from "./cbk";

const forexFixture = `<html><body><div>Daily KES Exchange Rates</div><div>US DOLLAR 129.61</div><div>STG POUND 173.30</div><div>EURO 148.90</div><div>Posted On: 18/09/2026</div><table><tr><td>Central Bank Rate</td><td>8.75%</td><td>11/08/2026</td></tr><tr><td>KESONIA</td><td>8.7497%</td><td>17/09/2026</td></tr></table></body></html>`;
const billsFixture = `<html><body><div>91-DAY Issue Number: 2701/091 Auction Date: 24th September 2026 Value Dated: 28th September 2026 Previous Average Interest Rate: 8.7837%</div><div>182-DAY Issue Number: 2675/182 Auction Date: 24th September 2026 Value Dated: 28th September 2026 Previous Average Interest Rate: 8.9099%</div><div>364-DAY Issue Number: 2630/364 Auction Date: 24th September 2026 Value Dated: 28th September 2026 Previous Average Interest Rate: 9.0566%</div></body></html>`;

describe("CBK parser and validation", () => {
  it("parses official-style FX and key-rate rows with observation dates", () => {
    const parsed = parseCbkForexPage(forexFixture);
    expect(parsed.rates.map((row) => row.instrument)).toEqual(["USD/KES", "GBP/KES", "EUR/KES"]);
    expect(parsed.rates[0]?.value).toBe(129.61);
    expect(parsed.keyRates.map((row) => row.instrument)).toContain("KESONIA");
    expect(parsed.rates[0]?.observationDate.toISOString()).toContain("2026-09-18");
  });

  it("parses the three official Treasury Bill tenors and rates", () => {
    const rows = parseCbkTreasuryBillsPage(billsFixture);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.tenorDays)).toEqual([91, 182, 364]);
    expect(rows[2]?.weightedAverageRate).toBe(9.0566);
    expect(rows.every((row) => row.validationStatus === "VALID")).toBe(true);
  });

  it("separates validated observations from quarantined values", () => {
    const parsed = parseCbkForexPage(forexFixture);
    const result = validateBatch({ marketRates: parsed.keyRates, fxRates: parsed.rates, treasuryBills: [] });
    expect(result.validFxRates).toHaveLength(3);
    expect(result.rejected).toHaveLength(0);
  });
});
