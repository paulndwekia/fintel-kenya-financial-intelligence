import { readFile } from "node:fs/promises";
import { parseHistoricalFxCsv } from "../server/ingestion/phase2";
const csv = await readFile("/tmp/cbk-fx-history.csv", "utf8");
const parsed = parseHistoricalFxCsv(csv, "https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv", { limit: 5000 });
console.log(JSON.stringify({ rows: parsed.rows.length, rejected: parsed.rejected.length, instruments: Array.from(new Set(parsed.rows.map((row) => row.instrument))).slice(0, 20), first: parsed.rows[0], last: parsed.rows.at(-1) }, null, 2));
