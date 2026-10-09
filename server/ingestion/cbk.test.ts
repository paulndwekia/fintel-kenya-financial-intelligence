import { describe, expect, it } from "vitest";
import { parseCbkForexPage, parseCbkTreasuryBillsPage, validateBatch } from "./cbk";

const forexFixture = `<html><body>
  <table><tr><td>05/01/2024</td><td>US DOLLAR</td><td>157.9012</td></tr></table>
  <div>Daily KES Exchange Rates</div>
  <div>US DOLLAR 129.91</div><div>STG POUND 172.04</div><div>EURO 145.92</div>
  <div>More...</div><div>Posted On: 09-10-2026</div>
  <h3>Key Rates</h3>
  <table>
    <tr><td>Central Bank Rate</td><td>8.75%</td><td>07/10/2026</td></tr>
    <tr><td>KESONIA</td><td>8.7510%</td><td>08/10/2026</td></tr>
    <tr><td>CBK Discount Window</td><td>9.25%</td><td>07/10/2026</td></tr>
    <tr><td>91-Day T-Bill</td><td>8.762%</td><td>12/10/2026</td></tr>
  </table><h4>QuickLinks</h4>
</body></html>`;

// This models the official CBK average-rate table's six columns:
// Issue Date, Issue Number, Tenor, Maturity Date, Average Interest Rate, MarketAverageRate.
const billsFixture = `<html><body><table>
  <tr><th>Issue Date</th><th>Issue Number</th><th>Tenor</th><th>Maturity Date</th><th>Average Interest Rate</th><th>MarketAverageRate</th></tr>
  <tr><td>2026-10-05</td><td>2702</td><td>91</td><td></td><td></td><td>8.7400</td></tr>
  <tr><td>2026-10-12</td><td>2703</td><td>91</td><td></td><td></td><td>8.7615</td></tr>
  <tr><td>2026-10-05</td><td>2676</td><td>182</td><td></td><td></td><td>8.8500</td></tr>
  <tr><td>2026-10-12</td><td>2677</td><td>182</td><td></td><td></td><td>8.8744</td></tr>
  <tr><td>2026-10-05</td><td>2631</td><td>364</td><td></td><td></td><td>9.0100</td></tr>
  <tr><td>2026-10-12</td><td>2632</td><td>364</td><td></td><td></td><td>9.0352</td></tr>
</table></body></html>`;

describe("CBK parser and validation", () => {
  it("uses the current FX block and its Posted On date rather than older archive values", () => {
    const parsed = parseCbkForexPage(forexFixture);
    expect(parsed.rates.map((row) => row.instrument)).toEqual(["USD/KES", "GBP/KES", "EUR/KES"]);
    expect(parsed.rates.map((row) => row.value)).toEqual([129.91, 172.04, 145.92]);
    expect(parsed.rates[0]?.observationDate.toISOString()).toContain("2026-10-09");
    expect(parsed.keyRates.map((row) => row.instrument)).toContain("KESONIA");
    expect(parsed.keyRates.find((row) => row.instrument === "KESONIA")?.observationDate.toISOString()).toContain("2026-10-08");
    // CBK's Forex landing page also shows a future 91-day bill cycle date;
    // the dedicated average-rate table is the valid source for T-Bill history.
    expect(parsed.keyRates.map((row) => row.instrument)).not.toContain("TBILL_91D");
    expect(parsed.keyRates.every((row) => row.observationDate.getTime() <= new Date("2026-10-09T00:00:00.000Z").getTime())).toBe(true);
  });

  it("uses the latest average-rate row per tenor rather than the next auction date", () => {
    const rows = parseCbkTreasuryBillsPage(billsFixture);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.tenorDays)).toEqual([91, 182, 364]);
    expect(rows.map((row) => row.weightedAverageRate)).toEqual([8.7615, 8.8744, 9.0352]);
    expect(rows[0]?.issueDate.toISOString()).toContain("2026-10-12");
    expect(rows.every((row) => row.validationStatus === "VALID")).toBe(true);
  });

  it("does not parse the Treasury Bills on Offer page as historical yield observations", () => {
    const offerPageFixture = `<html><body><div>91-DAY Issue Number: 2703/091 Auction Date: 15th October 2026 Value Dated: 19th October 2026 Previous Average Interest Rate: 8.7615%</div></body></html>`;
    expect(parseCbkTreasuryBillsPage(offerPageFixture)).toEqual([]);
  });

  it("separates validated observations from quarantined values", () => {
    const parsed = parseCbkForexPage(forexFixture);
    const result = validateBatch({ marketRates: parsed.keyRates, fxRates: parsed.rates, treasuryBills: [] });
    expect(result.validFxRates).toHaveLength(3);
    expect(result.rejected).toHaveLength(0);
  });
});
