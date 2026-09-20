import { describe, expect, it } from "vitest";
import { runEngine } from "./client";

describe("portfolio risk historical-data boundary", () => {
  const positions = [{ name: "Kenya Treasury Bond", asset_class: "FIXED_INCOME", value_kes: 1_000_000, duration: 4.2, volatility: 0.08 }];

  it("marks historical VaR and drawdown as DATA REQUIRED without observed prices", () => {
    const result = runEngine("portfolio_risk", { positions });
    expect(result.historical_status).toBe("DATA REQUIRED");
    expect(result.historical_var_kes).toBeNull();
    expect(result.historical_expected_shortfall_kes).toBeNull();
    expect(result.max_drawdown_pct).toBeNull();
  });

  it("calculates historical risk only from supplied observed prices", () => {
    const result = runEngine("portfolio_risk", {
      positions,
      historical_prices: [100, 101, 99, 102, 103, 101, 104, 105, 106, 104, 107, 108],
    });
    expect(result.historical_status).toBe("CURRENT");
    expect(result.historical_var_kes).toBeTypeOf("number");
    expect(result.historical_expected_shortfall_kes).toBeTypeOf("number");
    expect(result.max_drawdown_pct).toBeTypeOf("number");
  });
});

it("keeps the existing derivative engine available", () => {
  const result = runEngine("derivative_pricing", {
    model: "black_scholes",
    spot: 129.5,
    strike: 130,
    tenor_years: 0.5,
    rate: 0.1275,
    volatility: 0.16,
    option_type: "call",
  });
  expect(result.model).toBe("Black-Scholes");
  expect(result).toHaveProperty("delta");
});

it("keeps historical analytics observed-only", () => {
  const result = runEngine("historical_analytics", { prices: [100, 101, 99, 102, 103] });
  expect(result.observations).toBe(5);
  expect(result).toHaveProperty("historical_var_pct");
});
