#!/usr/bin/env bash
set -u
BASE="${FINTEL_BASE_URL:-https://3000-i7wcx02qyg988gdnkc9sr-2e4740de.us1.manus.computer}"
probe() {
  local name="$1"; shift
  echo "--- $name ---"
  curl -sS -w '\nHTTP %{http_code}\n' "$@"
}
probe bonds-before "$BASE/api/market/bonds"
probe bonds-backfill -X POST "$BASE/api/market/backfill" -H 'content-type: application/json' -d '{"source":"bonds","maxDocuments":2}'
probe fx-backfill -X POST "$BASE/api/market/backfill" -H 'content-type: application/json' -d '{"source":"fx","limit":1000}'
probe bills-backfill -X POST "$BASE/api/market/backfill" -H 'content-type: application/json' -d '{"source":"treasury_bills","limit":1000}'
probe health "$BASE/api/data/health"
