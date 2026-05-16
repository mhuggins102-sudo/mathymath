/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadAchievements,
  recordAchievementUnlock,
} from "@/lib/persistence/localStore";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe("achievements storage", () => {
  it("starts empty", () => {
    const s = loadAchievements();
    expect(s).toEqual({ v: 1, unlocked: {} });
  });
  it("records L1 then L2 without overwriting timestamps", () => {
    recordAchievementUnlock("speedrun", 1, "2026-05-01T00:00:00Z");
    let s = loadAchievements();
    expect(s.unlocked.speedrun?.level1At).toBe("2026-05-01T00:00:00Z");
    expect(s.unlocked.speedrun?.level2At).toBeUndefined();

    recordAchievementUnlock("speedrun", 2, "2026-05-02T00:00:00Z");
    s = loadAchievements();
    // L1 timestamp must remain the earlier value.
    expect(s.unlocked.speedrun?.level1At).toBe("2026-05-01T00:00:00Z");
    expect(s.unlocked.speedrun?.level2At).toBe("2026-05-02T00:00:00Z");
  });
  it("is idempotent on repeated unlocks", () => {
    recordAchievementUnlock("speedrun", 1, "2026-05-01T00:00:00Z");
    recordAchievementUnlock("speedrun", 1, "2026-05-09T00:00:00Z");
    const s = loadAchievements();
    expect(s.unlocked.speedrun?.level1At).toBe("2026-05-01T00:00:00Z");
  });
});
