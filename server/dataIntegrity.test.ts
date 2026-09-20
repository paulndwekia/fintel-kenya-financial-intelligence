import { describe, expect, it } from "vitest";
import {
  fxObservationKey,
  historicalObservationKey,
  isDuplicateKeyError,
  marketObservationKey,
  observationDayKey,
  treasuryBillObservationKey,
  treasuryBondObservationKey,
  yieldCurveObservationKey,
} from "./dataIntegrity";

describe("FINTEL observation natural keys", () => {
  const date = new Date("2026-09-18T00:00:00.000Z");

  it("normalizes observation dates to the observation day", () => {
    expect(observationDayKey(date)).toBe("2026-09-18");
  });

  it("keeps market observations unique by instrument and day", () => {
    expect(marketObservationKey(" usd/kes ", date)).toBe("USD/KES|2026-09-18");
    expect(marketObservationKey("USD/KES", date)).toBe(marketObservationKey(" usd/kes ", date));
  });

  it("keeps FX, bill, historical and curve keys deterministic", () => {
    expect(fxObservationKey("usd/kes", date)).toBe("USD/KES|2026-09-18");
    expect(treasuryBillObservationKey(91, date)).toBe("91|2026-09-18");
    expect(historicalObservationKey("USD/KES", date)).toBe("USD/KES|2026-09-18");
    expect(yieldCurveObservationKey("91D", date)).toBe("91D|2026-09-18");
    expect(treasuryBondObservationKey("FXD1/2026/1", date)).toBe("FXD1/2026/1|2026-09-18");
  });

  it("recognizes database duplicate-key errors without hiding other failures", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isDuplicateKeyError({ errno: 1062 })).toBe(true);
    expect(isDuplicateKeyError(new Error("Duplicate entry 'x' for key 'foo'"))).toBe(true);
    expect(isDuplicateKeyError(new Error("connection refused"))).toBe(false);
  });
});
