import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("FINTEL viewer permissions", () => {
  it("allows owner-scoped portfolio and risk reads", () => {
    expect(hasPermission("viewer", "portfolio.read")).toBe(true);
    expect(hasPermission("viewer", "risk.read")).toBe(true);
  });

  it("does not grant write or model execution permissions", () => {
    expect(hasPermission("viewer", "portfolio.write")).toBe(false);
    expect(hasPermission("viewer", "risk.run")).toBe(false);
    expect(hasPermission("viewer", "quant.run")).toBe(false);
  });
});
