import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { registerFinancialApi } from "../api";
import {
  ensureSourceDefinitions,
  scheduledCbkIngestionHandler,
} from "../scheduler";
import { securityMiddleware } from "../security";
import { createContext } from "./context";
import { checkDatabaseConnection } from "../db";

export function createFintelServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Liveness only: keep the web process available while the database is repaired.
  app.get("/api/system/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      status: "ok",
      service: "FINTEL",
      environment: process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: reports database connectivity without exposing credentials,
  // hostnames, SQL, or raw driver messages.
  app.get("/api/system/readiness", async (_req, res) => {
    const database = await checkDatabaseConnection();
    res.setHeader("Cache-Control", "no-store");
    res.status(database.status === "connected" ? 200 : 503).json({
      status: database.status === "connected" ? "ready" : "not_ready",
      service: "FINTEL",
      checks: { database },
      timestamp: new Date().toISOString(),
    });
  });

  app.use(securityMiddleware);

  registerStorageProxy(app);
  registerOAuthRoutes(app);
registerLocalAuthRoutes(app);

  const allowedOrigin = process.env.ALLOWED_ORIGIN;

  app.use((req, res, next) => {
    if (allowedOrigin && req.headers.origin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
      );
      return res.sendStatus(204);
    }

    next();
  });

  registerFinancialApi(app);

  app.post(
    "/api/scheduled/cbk-ingestion",
    scheduledCbkIngestionHandler,
  );

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return { app, server };
}

export function initialiseFintelSources() {
  ensureSourceDefinitions().catch((error) => {
    console.error(
      "FINTEL source initialization failed:",
      error instanceof Error ? error.message : error,
    );
  });
}

