#!/usr/bin/env bash
set -euo pipefail
BASE="${FINTEL_BASE_URL:-https://3000-i7wcx02qyg988gdnkc9sr-2e4740de.us1.manus.computer}"
mkdir -p /tmp/fintel-phase2
curl -fsS "$BASE/api/market/bonds" > /tmp/fintel-phase2/bonds-before.json
curl -fsS -X POST "$BASE/api/market/backfill" -H 'content-type: application/json' -d '{"source":"bonds","maxDocuments":5}' > /tmp/fintel-phase2/bonds-backfill.json
curl -fsS -X POST "$BASE/api/market/backfill" -H 'content-type: application/json' -d '{"source":"fx","limit":5000}' > /tmp/fintel-phase2/fx-backfill.json
curl -fsS -X POST "$BASE/api/market/backfill" -H 'content-type: application/json' -d '{"source":"treasury_bills","limit":5000}' > /tmp/fintel-phase2/bills-backfill.json
curl -fsS "$BASE/api/market/bonds" > /tmp/fintel-phase2/bonds-after.json
curl -fsS "$BASE/api/historical-market-data" > /tmp/fintel-phase2/historical.json
curl -fsS "$BASE/api/historical/analytics?instrument=USD%2FKES" > /tmp/fintel-phase2/historical-analytics.json
curl -fsS "$BASE/api/data/health" > /tmp/fintel-phase2/data-health.json
curl -fsS "$BASE/api/system/status" > /tmp/fintel-phase2/system-status.json
node -e 'const fs=require("fs"); for (const name of ["bonds-backfill","fx-backfill","bills-backfill","bonds-after","historical","historical-analytics","data-health","system-status"]) { const data=JSON.parse(fs.readFileSync(`/tmp/fintel-phase2/${name}.json`,"utf8")); console.log(name, JSON.stringify({status:data.status, parsedRecords:data.parsedRecords, documents:data.documents, persistence:data.persistence, totalRecords:data.totalRecords, instruments:data.instruments?.length, sources:data.sources?.map?.(s=>({name:s.name,status:s.status,recordCount:s.recordCount,latestObservation:s.latestObservation}))}, null, 2)); }'
