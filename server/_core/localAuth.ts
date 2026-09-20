import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function enabled() {
  return process.env.LOCAL_AUTH_ENABLED === "true";
}

function safeEqual(a: string, b: string) {
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function keyFor(req: Request, email: string) {
  return `${req.ip ?? "unknown"}:${email}`;
}

function blocked(key: string) {
  const x = attempts.get(key);
  if (!x) return false;
  if (Date.now() >= x.resetAt) {
    attempts.delete(key);
    return false;
  }
  return x.count >= MAX_ATTEMPTS;
}

function fail(key: string) {
  const now = Date.now();
  const x = attempts.get(key);
  if (!x || now >= x.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    x.count += 1;
  }
}

function clear(key: string) {
  attempts.delete(key);
}

function openId(email: string) {
  return `fintel:local:${crypto.createHash("sha256").update(email).digest("hex").slice(0, 48)}`;
}

export function registerLocalAuthRoutes(app: Express) {
  app.post("/api/auth/local/login", async (req: Request, res: Response) => {
    if (!enabled()) return res.status(404).json({ error: "Local FINTEL authentication is disabled" });

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const attemptKey = keyFor(req, email);
    if (blocked(attemptKey)) {
      return res.status(429).json({ error: "Too many failed login attempts. Try again later." });
    }

    const configuredEmail = (process.env.FINTEL_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const configuredPassword = process.env.FINTEL_ADMIN_PASSWORD ?? "";

    if (!configuredEmail || !configuredPassword) {
      return res.status(503).json({ error: "FINTEL administrator credentials are not configured" });
    }

    if (email !== configuredEmail || !safeEqual(password, configuredPassword)) {
      fail(attemptKey);
      return res.status(401).json({ error: "Invalid FINTEL credentials" });
    }

    clear(attemptKey);

    const name = (process.env.FINTEL_ADMIN_NAME ?? "").trim() || "FINTEL Administrator";
    const userOpenId = openId(email);

    try {
      await db.upsertUser({
        openId: userOpenId,
        name,
        email,
        loginMethod: "fintel-local",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const token = await sdk.signSession(
        { openId: userOpenId, appId: "fintel-local", name },
        { expiresInMs: ONE_YEAR_MS },
      );

      res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        httpOnly: true,
        maxAge: ONE_YEAR_MS,
      });

      return res.json({
        success: true,
        user: { email, name, role: "admin" },
      });
    } catch (error) {
      console.error("[FINTEL Auth] Database/session error:", error);
      return res.status(503).json({ error: "FINTEL could not create the authenticated session" });
    }
  });
}
