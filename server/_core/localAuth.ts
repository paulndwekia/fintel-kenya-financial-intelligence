import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";

type Attempt = { count: number; resetAt: number };
const loginAttempts = new Map<string, Attempt>();
const registrationAttempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const MAX_REGISTRATION_ATTEMPTS = 5;

function enabled() {
  return process.env.LOCAL_AUTH_ENABLED === "true";
}

function safeEqual(a: string, b: string) {
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function loginKey(req: Request, email: string) {
  return (req.ip ?? req.socket.remoteAddress ?? "unknown") + ":" + email;
}

function registrationKey(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function blocked(store: Map<string, Attempt>, key: string, maximum: number) {
  const value = store.get(key);
  if (!value) return false;
  if (Date.now() >= value.resetAt) {
    store.delete(key);
    return false;
  }
  return value.count >= maximum;
}

function recordFailure(store: Map<string, Attempt>, key: string) {
  const now = Date.now();
  const value = store.get(key);
  if (!value || now >= value.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    value.count += 1;
  }
}

function clearAttempt(store: Map<string, Attempt>, key: string) {
  store.delete(key);
}

function adminOpenId(email: string) {
  return "fintel:local:" + crypto.createHash("sha256").update(email).digest("hex").slice(0, 48);
}

function accountOpenId(email: string) {
  return "fintel:user:" + crypto.createHash("sha256").update(email).digest("hex").slice(0, 48);
}

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await derivePassword(password, salt);
  return "scrypt$" + salt + "$" + derived.toString("hex");
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, digest] = stored.split("$");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/i.test(salt ?? "") || !/^[a-f0-9]{128}$/i.test(digest ?? "")) {
    return false;
  }
  const expected = Buffer.from(digest, "hex");
  const actual = await derivePassword(password, salt);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function issueSession(res: Response, req: Request, openId: string, appId: string, name: string) {
  const token = await sdk.signSession({ openId, appId, name }, { expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    httpOnly: true,
    maxAge: ONE_YEAR_MS,
  });
}

function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function registerLocalAuthRoutes(app: Express) {
  app.post("/api/auth/local/register", async (req: Request, res: Response) => {
    if (!enabled()) return res.status(404).json({ error: "Account registration is not enabled yet." });

    const key = registrationKey(req);
    if (blocked(registrationAttempts, key, MAX_REGISTRATION_ATTEMPTS)) {
      return res.status(429).json({ error: "Too many account attempts. Please try again in 15 minutes." });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const reservedAdminEmail = (process.env.FINTEL_ADMIN_EMAIL ?? "").trim().toLowerCase();

    if (name.length < 2 || name.length > 80) {
      recordFailure(registrationAttempts, key);
      return res.status(400).json({ error: "Please enter your name (between 2 and 80 characters)." });
    }
    if (!validEmail(email)) {
      recordFailure(registrationAttempts, key);
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (reservedAdminEmail && email === reservedAdminEmail) {
      recordFailure(registrationAttempts, key);
      return res.status(409).json({ error: "That email is reserved for administrator sign-in." });
    }
    if (password.length < 12 || password.length > 128) {
      recordFailure(registrationAttempts, key);
      return res.status(400).json({ error: "Choose a password between 12 and 128 characters." });
    }

    try {
      const passwordHash = await hashPassword(password);
      const account = await db.createLocalAccount({
        openId: accountOpenId(email),
        name,
        email,
        passwordHash,
      });
      if (!account) {
        recordFailure(registrationAttempts, key);
        return res.status(409).json({ error: "An account with that email already exists. Try signing in instead." });
      }

      clearAttempt(registrationAttempts, key);
      await issueSession(res, req, account.openId, "fintel-local-account", account.name ?? name);
      return res.status(201).json({
        success: true,
        user: { id: account.id, name: account.name, email: account.email, role: account.role },
      });
    } catch (error) {
      console.error("[FINTEL Auth] Registration failed:", error);
      return res.status(503).json({ error: "We couldn't create your account just now. Please try again shortly." });
    }
  });

  app.post("/api/auth/local/login", async (req: Request, res: Response) => {
    if (!enabled()) return res.status(404).json({ error: "FINTEL sign-in is not enabled yet." });

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!validEmail(email) || !password) {
      return res.status(400).json({ error: "Enter your email address and password." });
    }

    const attemptKey = loginKey(req, email);
    if (blocked(loginAttempts, attemptKey, MAX_LOGIN_ATTEMPTS)) {
      return res.status(429).json({ error: "Too many failed sign-in attempts. Try again in 15 minutes." });
    }

    const configuredEmail = (process.env.FINTEL_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const configuredPassword = process.env.FINTEL_ADMIN_PASSWORD ?? "";

    try {
      if (configuredEmail && email === configuredEmail) {
        if (!configuredPassword || !safeEqual(password, configuredPassword)) {
          recordFailure(loginAttempts, attemptKey);
          return res.status(401).json({ error: "Those sign-in details don't match. Please try again." });
        }

        const name = (process.env.FINTEL_ADMIN_NAME ?? "").trim() || "FINTEL Administrator";
        const openId = adminOpenId(email);
        await db.upsertUser({
          openId,
          name,
          email,
          loginMethod: "fintel-local",
          role: "admin",
          lastSignedIn: new Date(),
        });
        await issueSession(res, req, openId, "fintel-local", name);
        clearAttempt(loginAttempts, attemptKey);
        return res.json({ success: true, user: { email, name, role: "admin" } });
      }

      const account = await db.getLocalAccountByEmail(email);
      if (!account || !(await verifyPassword(password, account.passwordHash))) {
        recordFailure(loginAttempts, attemptKey);
        return res.status(401).json({ error: "Those sign-in details don't match. Please try again." });
      }

      await db.upsertUser({ openId: account.openId, lastSignedIn: new Date() });
      await issueSession(res, req, account.openId, "fintel-local-account", account.name ?? email);
      clearAttempt(loginAttempts, attemptKey);
      return res.json({
        success: true,
        user: { id: account.id, email: account.email, name: account.name, role: account.role },
      });
    } catch (error) {
      console.error("[FINTEL Auth] Sign-in failed:", error);
      return res.status(503).json({ error: "FINTEL couldn't complete sign-in just now. Please try again shortly." });
    }
  });
}
