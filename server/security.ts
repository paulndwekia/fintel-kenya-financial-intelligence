import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

function limitForPath(path: string) {
  if (path.startsWith("/api/scheduled/") || path.startsWith("/api/market/backfill")) return 10;
  if (path.startsWith("/api/market/refresh")) return 10;
  if (path.startsWith("/api/derivatives") || path.startsWith("/api/greeks") || path.startsWith("/api/monte-carlo") || path.startsWith("/api/risk/")) return 30;
  if (path.startsWith("/api/oauth")) return 20;
  return 120;
}

function clientKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const address = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : req.socket.remoteAddress ?? "unknown";
  return `${address}:${req.method}:${req.path.startsWith("/api/") ? req.path.split("/").slice(0, 4).join("/") : "web"}`;
}

export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"] ? req.headers["x-request-id"] : crypto.randomUUID();
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  const limit = limitForPath(req.path);
  const key = clientKey(req);
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + WINDOW_MS };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({ status: "RATE LIMITED", message: "Too many requests for this endpoint class", requestId });
  }
  return next();
}
