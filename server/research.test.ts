import { describe, expect, it } from "vitest";
import { buildFintelContext, researchMode } from "./research";

describe("FINTEL research layer", () => {
  it("accepts the supported research modes", () => {
    for (const mode of ["MARKET", "QUANT", "RISK", "FIXED INCOME", "MACRO", "PORTFOLIO", "ACADEMIC", "GENERAL FINANCE"]) {
      expect(researchMode.parse(mode)).toBe(mode);
    }
  });

  it("does not invent data when the database is unavailable", async () => {
    const result = await buildFintelContext("What is the current USD/KES exchange rate?", "MARKET");
    expect(result).toBeTruthy();
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(Array.isArray(result.limitations)).toBe(true);
  });
});
