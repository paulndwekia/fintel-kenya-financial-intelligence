import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { securityMiddleware } from "./security";

function makeResponse() {
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name, value); return response; },
    getHeader: (name: string) => headers.get(name),
    status: vi.fn(() => response),
    json: vi.fn(() => response),
  } as unknown as Response;
  return { response, headers };
}

function makeRequest(path = "/api/market/cbk") {
  return { headers: {}, method: "GET", path, socket: { remoteAddress: `test-${Math.random()}` } } as unknown as Request;
}

describe("FINTEL security middleware", () => {
  it("adds request correlation and secure response headers", () => {
    const { response, headers } = makeResponse();
    const next = vi.fn();
    securityMiddleware(makeRequest(), response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(headers.get("X-Request-ID")).toBeTruthy();
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("returns 429 after the endpoint-class limit is exceeded", () => {
    const next = vi.fn();
    const { response } = makeResponse();
    const request = makeRequest("/api/derivatives/price");
    for (let index = 0; index < 31; index += 1) securityMiddleware(request, response, next);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ status: "RATE LIMITED" }));
  });
});
