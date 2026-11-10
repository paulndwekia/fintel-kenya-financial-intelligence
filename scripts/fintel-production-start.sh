#!/bin/sh
set -eu

echo "[FINTEL] Using the pre-provisioned Neon PostgreSQL schema."
echo "[FINTEL] Startup schema push is intentionally disabled; schema changes must be applied as reviewed SQL migrations."
echo "[FINTEL] Starting production server..."

exec node dist/index.js
