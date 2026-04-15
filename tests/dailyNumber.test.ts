import { describe, it, expect } from "vitest";
import {
  computeDailyNumber,
  LAUNCH_DATE_ISO,
} from "@/lib/game/targetGenerator";

describe("computeDailyNumber", () => {
  it("launch date is Daily #1", () => {
    expect(computeDailyNumber(LAUNCH_DATE_ISO)).toBe(1);
    expect(computeDailyNumber("2026-04-01")).toBe(1);
  });
  it("day after launch is Daily #2", () => {
    expect(computeDailyNumber("2026-04-02")).toBe(2);
  });
  it("counts cleanly across a month boundary", () => {
    // April has 30 days → 2026-04-30 = Daily #30, 2026-05-01 = Daily #31.
    expect(computeDailyNumber("2026-04-30")).toBe(30);
    expect(computeDailyNumber("2026-05-01")).toBe(31);
  });
});
