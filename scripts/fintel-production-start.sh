#!/bin/sh
set -eu

echo "[FINTEL] Applying pending database migrations..."
pnpm exec drizzle-kit migrate --config=./drizzle.config.ts

echo "[FINTEL] Database migrations complete."
echo "[FINTEL] Starting production server..."

exec node dist/index.js