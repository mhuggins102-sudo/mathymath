import { describe, it, expect } from "vitest";
import {
  canUseLockOnGuess,
  certainDigitsFromLocks,
  countExtraLocksGained,
  EXTRA_LOCK_CLUE_ID,
  INITIAL_LOCKS,
  locksAvailable,
  MAX_LOCKS,
  type LockRecord,
} from "@/lib/game/locks";

describe("locks constants", () => {
  it("starts each game with 1 lock and caps at 2", () => {
    expect(INITIAL_LOCKS).toBe(1);
    expect(MAX_LOCKS).toBe(2);
  });
});

describe("canUseLockOnGuess", () => {
  it("disabled on guess 1 (index 0), enabled from guess 2+", () => {
    expect(canUseLockOnGuess(0)).toBe(false);
    expect(canUseLockOnGuess(1)).toBe(true);
    expect(canUseLockOnGuess(7)).toBe(true);
  });
});

describe("countExtraLocksGained", () => {
  it("counts the extraLock clue picks in history", () => {
    const history = [
      { clueId: "oracle" },
      { clueId: EXTRA_LOCK_CLUE_ID },
      { clueId: "thermometer" },
      { clueId: EXTRA_LOCK_CLUE_ID },
    ];
    expect(countExtraLocksGained(history)).toBe(2);
  });
  it("is 0 for empty history", () => {
    expect(countExtraLocksGained([])).toBe(0);
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
  it("Extra Lock grants +1 (cap 2)", () => {
    expect(locksAvailable([{ clueId: EXTRA_LOCK_CLUE_ID }])).toBe(2);
    // Two extraLock clues still cap at 2, not 3.
    expect(
      locksAvailable([
        { clueId: EXTRA_LOCK_CLUE_ID },
        { clueId: EXTRA_LOCK_CLUE_ID },
      ]),
    ).toBe(2);
  });
  it("Extra Lock after spending can restore up to cap", () => {
    const wrong: LockRecord = { slot: 1, digit: "7", correct: false };
    // Start 1, spend 1 → 0 remaining, Extra Lock → cap 2 − 1 spent = 1.
    expect(
      locksAvailable([
        { locks: [wrong] },
        { clueId: EXTRA_LOCK_CLUE_ID },
      ]),
    ).toBe(1);
  });
  it("never goes below 0", () => {
    const wrongA: LockRecord = { slot: 0, digit: "1", correct: false };
    const wrongB: LockRecord = { slot: 1, digit: "2", correct: false };
    const wrongC: LockRecord = { slot: 2, digit: "3", correct: false };
    // More wrong locks than the cap (shouldn't happen in practice, but
    // the function still returns a sane 0 rather than negative).
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
