import { describe, it, expect } from "vitest";
import {
  BONUS_LOCK_CLUE_IDS,
  canUseLockOnGuess,
  certainDigitsFromLocks,
  countBonusLocksGained,
  CLUE_REUSE_CLUE_ID,
  EXTRA_LOCK_CLUE_ID,
  INITIAL_LOCKS,
  locksAvailable,
  type LockRecord,
} from "@/lib/game/locks";

describe("locks constants", () => {
  it("starts each game with 1 lock", () => {
    expect(INITIAL_LOCKS).toBe(1);
  });
  it("BONUS_LOCK_CLUE_IDS covers the three bonus-lock clues plus legacy Extra Lock", () => {
    expect(BONUS_LOCK_CLUE_IDS.has("distinctDigits")).toBe(true);
    expect(BONUS_LOCK_CLUE_IDS.has("upsAndDowns")).toBe(true);
    expect(BONUS_LOCK_CLUE_IDS.has("divisibleBy")).toBe(true);
    expect(BONUS_LOCK_CLUE_IDS.has(EXTRA_LOCK_CLUE_ID)).toBe(true);
  });
});

describe("canUseLockOnGuess", () => {
  it("allows locks on every guess (no per-turn restriction)", () => {
    expect(canUseLockOnGuess()).toBe(true);
  });
});

describe("countBonusLocksGained", () => {
  it("counts bonus-lock clue picks in history", () => {
    const history = [
      { clueId: "oracle" },
      { clueId: "distinctDigits" },
      { clueId: "thermometer" },
      { clueId: "upsAndDowns" },
      { clueId: "divisibleBy" },
    ];
    expect(countBonusLocksGained(history)).toBe(3);
  });
  it("still counts legacy Extra Lock picks (replays)", () => {
    const history = [
      { clueId: EXTRA_LOCK_CLUE_ID },
      { clueId: EXTRA_LOCK_CLUE_ID },
    ];
    expect(countBonusLocksGained(history)).toBe(2);
  });
  it("counts Clue Reuse of a bonus-lock clue", () => {
    const history = [
      { clueId: "distinctDigits" },
      {
        clueId: CLUE_REUSE_CLUE_ID,
        result: { kind: "distinctDigits", count: 4, sharedRepeated: [] },
      },
    ];
    // First pick is bonus-lock; the reuse re-applies the same clue and
    // grants another +1.
    expect(countBonusLocksGained(history)).toBe(2);
  });
  it("does NOT double-count Clue Reuse of a non-bonus clue", () => {
    const history = [
      { clueId: "oracle" },
      {
        clueId: CLUE_REUSE_CLUE_ID,
        result: { kind: "oracle", slot: 0, digit: 1 },
      },
    ];
    expect(countBonusLocksGained(history)).toBe(0);
  });
  it("is 0 for empty history", () => {
    expect(countBonusLocksGained([])).toBe(0);
  });
});

describe("locksAvailable", () => {
  it("returns initialLocks (1) at start of game", () => {
    expect(locksAvailable([])).toBe(1);
  });
  it("spends a lock on an incorrect lock, keeps on correct", () => {
    const correct: LockRecord = { slot: 0, digit: "5", correct: true };
    const wrong: LockRecord = { slot: 1, digit: "7", correct: false };
    expect(locksAvailable([{ locks: [correct] }])).toBe(1);
    expect(locksAvailable([{ locks: [wrong] }])).toBe(0);
  });
  it("each bonus-lock clue grants +1 with no cap", () => {
    expect(locksAvailable([{ clueId: "distinctDigits" }])).toBe(2);
    expect(
      locksAvailable([
        { clueId: "distinctDigits" },
        { clueId: "upsAndDowns" },
      ]),
    ).toBe(3);
    // Three bonus-lock picks: initial 1 + 3 = 4 (previously capped at 3).
    expect(
      locksAvailable([
        { clueId: "distinctDigits" },
        { clueId: "upsAndDowns" },
        { clueId: "divisibleBy" },
      ]),
    ).toBe(4);
  });
  it("legacy Extra Lock still grants +1 for replays", () => {
    expect(locksAvailable([{ clueId: EXTRA_LOCK_CLUE_ID }])).toBe(2);
  });
  it("Bonus lock after spending restores up to the new cap", () => {
    const wrong: LockRecord = { slot: 1, digit: "7", correct: false };
    // Start 1, spend 1 → 0 remaining, bonus-lock pick → cap 2 − 1 spent = 1.
    expect(
      locksAvailable([
        { locks: [wrong] },
        { clueId: "distinctDigits" },
      ]),
    ).toBe(1);
  });
  it("Clue Reuse picks cost 1 lock", () => {
    // Start budget 1; pick Clue Reuse → 0 remaining.
    expect(
      locksAvailable([{ clueId: CLUE_REUSE_CLUE_ID }]),
    ).toBe(0);
    // Two bonus-lock picks bring cap to 3; one Clue Reuse pick costs 1
    // → 3 - 1 = 2 remaining.
    expect(
      locksAvailable([
        { clueId: "distinctDigits" },
        { clueId: "upsAndDowns" },
        { clueId: CLUE_REUSE_CLUE_ID },
      ]),
    ).toBe(2);
  });
  it("supports multi-redraw: N redraws cost N locks", () => {
    // Two bonus-lock picks → cap 3. Three redraws on one turn spend 3.
    expect(
      locksAvailable([
        { clueId: "distinctDigits" },
        { clueId: "upsAndDowns" },
        { redraws: 3 },
      ]),
    ).toBe(0);
  });
  it("never goes below 0", () => {
    const wrongA: LockRecord = { slot: 0, digit: "1", correct: false };
    const wrongB: LockRecord = { slot: 1, digit: "2", correct: false };
    const wrongC: LockRecord = { slot: 2, digit: "3", correct: false };
    expect(
      locksAvailable([{ locks: [wrongA, wrongB, wrongC] }]),
    ).toBe(0);
  });
});

describe("certainDigitsFromLocks", () => {
  it("treats correct locks as revealed target digits", () => {
    const history = [
      {
        locks: [
          { slot: 1, digit: "7", correct: true } as LockRecord,
          { slot: 3, digit: "2", correct: false } as LockRecord,
        ],
      },
    ];
    expect(certainDigitsFromLocks(history, 5)).toEqual([
      null,
      "7",
      null,
      null,
      null,
    ]);
  });
  it("ignores entries without a locks field", () => {
    expect(certainDigitsFromLocks([{}], 5)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
