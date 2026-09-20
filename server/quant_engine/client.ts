import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export type DataStatus = "LIVE" | "STALE" | "DATA REQUIRED" | "ERROR";

const enginePath = path.resolve(process.cwd(), "server/quant_engine/engine.py");

export class QuantEngineError extends Error {
  constructor(message: string, public readonly code: "BACKEND OFFLINE" | "CALCULATION ERROR" = "CALCULATION ERROR") {
    super(message);
    this.name = "QuantEngineError";
  }
}

export function runEngine(command: string, payload: unknown = {}) {
  const result = spawnSync("python3", [enginePath, command], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw new QuantEngineError(`Python engine unavailable: ${result.error.message}`, "BACKEND OFFLINE");
  if (result.status !== 0) throw new QuantEngineError(result.stderr?.trim() || "Python calculation failed", "CALCULATION ERROR");
  try {
    const parsed = JSON.parse(result.stdout);
    if (parsed?.error) throw new QuantEngineError(parsed.error, "CALCULATION ERROR");
    return parsed;
  } catch (error) {
    if (error instanceof QuantEngineError) throw error;
    throw new QuantEngineError("Python engine returned invalid JSON", "CALCULATION ERROR");
  }
}

export function engineStatus() {
  if (!existsSync(enginePath)) return { status: "BACKEND OFFLINE" as const, source: "Local Python Quant Engine", timestamp: new Date().toISOString(), message: "Engine file not found" };
  const probe = spawnSync("python3", ["-c", "import numpy, scipy"], { encoding: "utf8", timeout: 10000 });
  if (probe.error || probe.status !== 0) return { status: "BACKEND OFFLINE" as const, source: "Local Python Quant Engine", timestamp: new Date().toISOString(), message: probe.stderr?.trim() || "Python dependencies unavailable" };
  return { status: "LIVE" as DataStatus, source: "Local Python Quant Engine", timestamp: new Date().toISOString(), probe: "python runtime and scientific dependencies available" };
}

export const sampleMarketFields = ["CBK rate", "USD/KES", "91-day T-bill", "182-day T-bill", "364-day T-bill", "10Y Kenya Bond"];

export function unavailableSource(source: string, fields: string[]) {
  return { status: "DATA REQUIRED" as DataStatus, source, timestamp: null, fields, message: "Backend connection required", values: null };
}

export function sourceStatus(source: string, configuredUrl?: string) {
  return configuredUrl ? { status: "STALE" as DataStatus, source, timestamp: null, message: "Connector configured; awaiting a successful refresh" } : { status: "DATA REQUIRED" as DataStatus, source, timestamp: null, message: "Backend connection required" };
}

export function derivativePayload(input: any, forceModel?: string) {
  return { model: forceModel ?? input.model, spot: input.spot, strike: input.strike, tenor_years: input.tenorYears, rate: input.rate, volatility: input.volatility, option_type: input.optionType };
}
