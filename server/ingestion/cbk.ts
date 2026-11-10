export async function fetchWithRetry(url: string, attempts = 4): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await axios.get<string>(url, { timeout: 45000, responseType: "text", headers: { "user-agent": "FINTEL-CBK-Ingestion/1.0", accept: "text/html,text/csv,application/xhtml+xml,application/json", "cache-control": "no-cache" } });
      if (response.status < 200 || response.status >= 300) throw new Error(`CBK returned HTTP ${response.status}`);
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("CBK request failed");
}
