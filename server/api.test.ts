import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerFinancialApi } from "./api";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerFinancialApi(app);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address !== "string") baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("financial REST integration", () => {
  it("returns a trustable CBK state with source metadata", async () => {
    const response = await fetch(`${baseUrl}/api/market/cbk`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(["CURRENT", "STALE", "DATA REQUIRED"]).toContain(body.status);
    expect(body.source).toBe("Central Bank of Kenya");
    expect(body.sourceUrl).toContain("centralbank.go.ke");
  });

  it("connects yield curve requests to the Python engine", async () => {
    const response = await fetch(`${baseUrl}/api/yield-curve`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(["CURRENT", "STALE", "DATA REQUIRED"]).toContain(body.status);
    expect(body.source).toBeDefined();
    if (body.status !== "DATA REQUIRED") expect(body.values.length).toBeGreaterThan(0);
  });

  it("connects derivative pricing and refresh status to backend services", async () => {
    const pricing = await fetch(`${baseUrl}/api/derivatives/price`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "black_scholes", spot: 129.5, strike: 130, tenorYears: 0.5, rate: 0.1275, volatility: 0.16, optionType: "call" }) });
    const pricingBody = await pricing.json();
    expect(pricingBody.status).toBe("LIVE");
    expect(pricingBody.values).toHaveProperty("delta");

    const refresh = await fetch(`${baseUrl}/api/market/refresh`, { method: "POST" });
    const refreshBody = await refresh.json();
    expect(refresh.status).toBe(401);
    expect(refreshBody.status).toBe("UNAUTHORIZED");
  }, 45000);

  it("exposes Treasury Bonds through the persisted-data contract", async () => {
    const response = await fetch(`${baseUrl}/api/market/bonds`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(["CURRENT", "STALE", "DATA REQUIRED"]).toContain(body.status);
    expect(body.source).toBe("Central Bank of Kenya");
    if (body.status !== "DATA REQUIRED") expect(body.observations[0]).toHaveProperty("securityCode");
  });

  it("never substitutes simulated history when analytics lacks observations", async () => {
    const response = await fetch(`${baseUrl}/api/historical/analytics?instrument=UNAVAILABLE_TEST_SERIES`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(["LIVE", "INSUFFICIENT HISTORY"]).toContain(body.status);
    if (body.status === "INSUFFICIENT HISTORY") expect(body.values).toBeNull();
  });
});
