#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const output = process.argv[2] ?? "backups/fintel-schema.sql";
const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is required; no export was attempted.");
  process.exit(2);
}

const url = new URL(raw);
const password = decodeURIComponent(url.password);
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!url.hostname || !url.username || !database) {
  console.error("DATABASE_URL is missing host, user, or database; no export was attempted.");
  process.exit(2);
}

mkdirSync(dirname(output), { recursive: true });
const args = [
  "--host", url.hostname,
  "--port", String(url.port || 3306),
  "--user", decodeURIComponent(url.username),
  "--ssl-mode=REQUIRED",
  "--no-data",
  "--skip-comments",
  "--skip-lock-tables",
  database,
];
const result = spawnSync("mysqldump", args, {
  env: { ...process.env, MYSQL_PWD: password },
  stdio: ["ignore", "pipe", "pipe"],
  encoding: "utf8",
});
if (result.status !== 0) {
  const safeError = String(result.stderr || "unknown mysqldump error")
    .replaceAll(url.hostname, "<host>")
    .replaceAll(decodeURIComponent(url.username), "<user>")
    .replaceAll(database, "<database>")
    .replaceAll(password, "<redacted>")
    .trim()
    .slice(0, 500);
  console.error(`Schema export failed: ${safeError}`);
  process.exit(result.status ?? 1);
}
await import("node:fs").then(({ writeFileSync }) => writeFileSync(output, result.stdout, { mode: 0o600 }));
console.log(`Schema-only backup written to ${output}`);
