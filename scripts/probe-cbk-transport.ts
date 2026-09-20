import axios from "axios";
const url = "https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv";
const started = Date.now();
const response = await axios.get<string>(url, { timeout: 45000, responseType: "text", headers: { "user-agent": "FINTEL-CBK-Ingestion/1.0", accept: "text/csv" } });
console.log(JSON.stringify({ status: response.status, bytes: response.data.length, ms: Date.now() - started, head: response.data.slice(0, 120) }));
