/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadAchievements,
  recordAchievementCriterion,
  recordAchievementUnlock,
} from "@/lib/persistence/localStore";
import { runAchievementCheck } from "@/lib/achievements/check";
import type { AchievementCtx } from "@/lib/achievements/types";
import type { ClueResult } from "@/lib/game/clues/types";

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

  it("records per-criterion timestamps without overwriting earlier ones", () => {
    recordAchievementCriterion("diceDiceBaby", "allDice", "2026-05-10T00:00:00Z");
    let s = loadAchievements();
    expect(s.unlocked.diceDiceBaby?.criteria?.allDice).toBe("2026-05-10T00:00:00Z");
    expect(s.unlocked.diceDiceBaby?.criteria?.noDice).toBeUndefined();

    recordAchievementCriterion("diceDiceBaby", "noDice", "2026-05-12T00:00:00Z");
    s = loadAchievements();
    expect(s.unlocked.diceDiceBaby?.criteria?.allDice).toBe("2026-05-10T00:00:00Z");
    expect(s.unlocked.diceDiceBaby?.criteria?.noDice).toBe("2026-05-12T00:00:00Z");

    // Idempotent on repeat — the first timestamp wins.
    recordAchievementCriterion("diceDiceBaby", "allDice", "2026-05-20T00:00:00Z");
    s = loadAchievements();
    expect(s.unlocked.diceDiceBaby?.criteria?.allDice).toBe("2026-05-10T00:00:00Z");
  });
});

// --- Criteria flow through runAchievementCheck ---

function baseCtx(overrides: Partial<AchievementCtx> = {}): AchievementCtx {
  return {
    mode: "unlimited",
    digits: 5,
    status: "won",
    target: "12345",
    guesses: [],
    advancedMode: false,
    preselectedMode: false,
    maxGuesses: 7,
    totalWins: 0,
    locksRemaining: 0,
    redrawsUsed: 0,
    dailyStreakEndingToday: 0,
    unlimitedStreakByBucket: {
      "5": {
        normal: { manual: 0, auto: 0 },
        hard: { manual: 0, auto: 0 },
      },
      "6": {
        normal: { manual: 0, auto: 0 },
        hard: { manual: 0, auto: 0 },
      },
    },
    ...overrides,
  };
}

const allRed: ClueResult = { kind: "thermometer", tier: [2, 2, 2, 2, 2] };
const allBlue: ClueResult = { kind: "thermometer", tier: [0, 0, 0, 0, 0] };

function mercuryUnlocks(id: string) {
  const store = loadAchievements();
  return store.unlocked[id] ?? {};
}

describe("criteria-flow through runAchievementCheck (Mercury Rising)", () => {
  it("A-only run earns silver (level 1) and records the A criterion", () => {
    const unlocks = runAchievementCheck(
      baseCtx({
        guesses: [{ guess: "11111", result: allRed }],
      }),
    );
    const mercury = unlocks.filter((u) => u.id === "mercuryRising");
    expect(mercury).toEqual([{ id: "mercuryRising", level: 1 }]);
    const stored = mercuryUnlocks("mercuryRising");
    expect(stored.level1At).toBeDefined();
    expect(stored.level2At).toBeUndefined();
    expect(stored.criteria?.allRed).toBeDefined();
    expect(stored.criteria?.allBlue).toBeUndefined();
  });

  it("B-only run earns silver (level 1) and records the B criterion", () => {
    const unlocks = runAchievementCheck(
      baseCtx({ guesses: [{ guess: "12345", result: allBlue }] }),
    );
    const mercury = unlocks.filter((u) => u.id === "mercuryRising");
    expect(mercury).toEqual([{ id: "mercuryRising", level: 1 }]);
    const stored = mercuryUnlocks("mercuryRising");
    expect(stored.criteria?.allBlue).toBeDefined();
    expect(stored.criteria?.allRed).toBeUndefined();
  });

  it("A then B promotes to gold; A timestamp is preserved", () => {
    runAchievementCheck(
      baseCtx({ guesses: [{ guess: "11111", result: allRed }] }),
    );
    const afterA = mercuryUnlocks("mercuryRising");
    expect(afterA.level1At).toBeDefined();
    expect(afterA.level2At).toBeUndefined();
    const aTimestamp = afterA.criteria?.allRed;
    expect(aTimestamp).toBeDefined();

    const secondUnlocks = runAchievementCheck(
      baseCtx({ guesses: [{ guess: "12345", result: allBlue }] }),
    );
    const mercury = secondUnlocks.filter((u) => u.id === "mercuryRising");
    expect(mercury).toEqual([{ id: "mercuryRising", level: 2 }]);
    const afterB = mercuryUnlocks("mercuryRising");
    expect(afterB.level2At).toBeDefined();
    expect(afterB.criteria?.allRed).toBe(aTimestamp);
    expect(afterB.criteria?.allBlue).toBeDefined();
  });

  it("B then A also promotes to gold", () => {
    runAchievementCheck(
      baseCtx({ guesses: [{ guess: "12345", result: allBlue }] }),
    );
    expect(mercuryUnlocks("mercuryRising").level2At).toBeUndefined();
    const secondUnlocks = runAchievementCheck(
      baseCtx({ guesses: [{ guess: "11111", result: allRed }] }),
    );
    const mercury = secondUnlocks.filter((u) => u.id === "mercuryRising");
    expect(mercury).toEqual([{ id: "mercuryRising", level: 2 }]);
    expect(mercuryUnlocks("mercuryRising").level2At).toBeDefined();
  });

  it("re-running after gold doesn't re-emit unlocks", () => {
    runAchievementCheck(
      baseCtx({ guesses: [{ guess: "11111", result: allRed }] }),
    );
    runAchievementCheck(
      baseCtx({ guesses: [{ guess: "12345", result: allBlue }] }),
    );
    const stable = runAchievementCheck(
      baseCtx({ guesses: [{ guess: "11111", result: allRed }] }),
    );
    expect(stable.filter((u) => u.id === "mercuryRising")).toEqual([]);
  });

  it("a single game that meets BOTH prongs emits L1 and L2 in one shot", () => {
    const unlocks = runAchievementCheck(
      baseCtx({
        guesses: [
          { guess: "11111", result: allRed },
          { guess: "12345", result: allBlue },
        ],
      }),
    );
    const mercury = unlocks.filter((u) => u.id === "mercuryRising");
    expect(mercury).toEqual([
      { id: "mercuryRising", level: 1 },
      { id: "mercuryRising", level: 2 },
    ]);
  });
});
