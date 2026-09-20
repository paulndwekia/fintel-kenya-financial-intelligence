import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createReadOnlyContext(): TrpcContext {
  const now = new Date();
  return { ...createContext(), user: { id: 22, openId: "viewer", name: "Viewer", email: "viewer@example.com", loginMethod: "test", role: "viewer", createdAt: now, updatedAt: now, lastSignedIn: now } };
}

describe("financial analytics API", () => {
  it("exposes the model registry with the preserved pricing and risk models", async () => {
    const registry = await appRouter.createCaller(createContext()).models.registry();
    expect(registry.map(model => model.model)).toEqual(expect.arrayContaining([
      "Black-Scholes-Merton", "CRR Binomial", "Monte Carlo", "Portfolio VaR",
    ]));
  });

  it("routes derivative pricing to the Python engine and returns Greeks", async () => {
    const result = await appRouter.createCaller(createContext()).analytics.derivative({
      model: "black_scholes", spot: 129.5, strike: 130, tenorYears: 0.5, rate: 0.1275, volatility: 0.16, optionType: "call",
    });
    expect(result.model).toBe("Black-Scholes");
    expect(result.price).toBeGreaterThan(0);
    expect(result).toHaveProperty("delta");
    expect(result).toHaveProperty("gamma");
    expect(result).toHaveProperty("vega");
  });

  it("rejects portfolio writes for read-only roles before touching the database", async () => {
    await expect(appRouter.createCaller(createReadOnlyContext()).portfolio.create({ name: "Blocked portfolio", baseCurrency: "KES" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not expose portfolio risk to unauthenticated or viewer contexts", async () => {
    await expect(appRouter.createCaller(createContext()).analytics.risk()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(createReadOnlyContext()).risk.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
