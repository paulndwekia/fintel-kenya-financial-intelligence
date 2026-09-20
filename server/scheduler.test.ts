import { describe, expect, it } from "vitest";
import { INGESTION_SCHEDULES } from "./scheduler";

describe("FINTEL scheduled ingestion contract", () => {
  it("defines separate expected frequencies and a valid scheduled callback path", () => {
    expect(INGESTION_SCHEDULES.map((job) => job.sourceName)).toEqual(expect.arrayContaining(["CBK key rates and FX", "CBK Treasury Bills", "CBK Treasury Bonds", "Historical market database"]));
    expect(INGESTION_SCHEDULES.every((job) => job.path.startsWith("/api/scheduled/"))).toBe(true);
    expect(INGESTION_SCHEDULES.every((job) => job.cron.split(" ").length === 6)).toBe(true);
  });
});
