const baseUrl = (process.env.FINTEL_BASE_URL ?? "").replace(/\/+$/, "");
const source = process.env.CBK_CRON_SOURCE ?? "";
const secret = process.env.CBK_CRON_SECRET ?? "";

if (!baseUrl) throw new Error("FINTEL_BASE_URL is required");
if (!source) throw new Error("CBK_CRON_SOURCE is required");
if (!secret) throw new Error("CBK_CRON_SECRET is required");

const url =
  `${baseUrl}/api/scheduled/cbk-ingestion?source=${encodeURIComponent(source)}`;

const response = await fetch(url, {
  method: "GET",
  headers: {
    "x-fintel-cron-secret": secret,
    "user-agent": "FINTEL-Render-CBK-Cron/1.0",
    "accept": "application/json",
  },
});

const text = await response.text();

console.log(text);

if (!response.ok) {
  process.exit(1);
}
