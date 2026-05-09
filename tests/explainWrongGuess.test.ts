import { describe, it, expect } from "vitest";
import { explainWrongGuess } from "@/lib/game/deduction/explain";
import type { DeductionPuzzle } from "@/lib/game/deduction/puzzles";

const samplePuzzle: DeductionPuzzle = {
  id: "test-1",
  digits: 5,
  target: "47396",
  difficulty: 50,
  guesses: [
    {
      guess: "47390",
      clueId: "bullseyes",
      result: { kind: "bullseyes", hits: [true, true, true, true, false] },
    },
    {
      guess: "47395",
      clueId: "sumDelta",
      result: { kind: "sumDelta", delta: 1 },
    },
  ],
};

describe("explainWrongGuess", () => {
  it("returns no failures when the guess is the target", () => {
    expect(explainWrongGuess(samplePuzzle, "47396")).toEqual([]);
  });

  it("pinpoints a violated bullseye position", () => {
    // 17396 — first digit is 1, not 4. Bullseye at slot 1 expects 4.
    const failures = explainWrongGuess(samplePuzzle, "17396");
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]).toContain("position 1");
    expect(failures[0]).toContain("Bullseye");
  });

  it("pinpoints a violated sum-delta", () => {
    // 47390 — digit sum 23. Bullseyes pass (positions 1-4 match 47390).
    // But sumDelta says target sum should be 28 (47395 sum 28 + delta 1
    // from sumDelta result {delta:1} means target sum = 28+1 = 29).
    // 47390 sums to 23 — also fails sumDelta.
    const failures = explainWrongGuess(samplePuzzle, "47390");
    const sumFailure = failures.find((f) => f.includes("Digit Sum"));
    expect(sumFailure).toBeDefined();
    expect(sumFailure).toContain("digit sum");
  });

  it("explains a containsDigit violation", () => {
    // Recorded result says: picking slot 1 (digit 7 in guess "07000")
    // returned absent against the real target. wrongGuess "12347"
    // contains a 7, so the same slot pick would have returned present
    // there — failure surfaces.
    const puzzle: DeductionPuzzle = {
      id: "test-2",
      digits: 5,
      target: "12345",
      difficulty: 30,
      guesses: [
        {
          guess: "07000",
          clueId: "containsDigit",
          result: {
            kind: "containsDigit",
            picks: [
              { slot: 1, digit: 7, present: false, exact: false },
            ],
          },
        },
      ],
    };
    const failures = explainWrongGuess(puzzle, "12347");
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain("slot 2");
  });

  it("explains a distinctDigits violation", () => {
    const puzzle: DeductionPuzzle = {
      id: "test-3",
      digits: 5,
      target: "12345",
      difficulty: 30,
      guesses: [
        {
          guess: "00000",
          clueId: "distinctDigits",
          result: { kind: "distinctDigits", count: 5, sharedRepeated: [false, false, false, false, false] },
        },
      ],
    };
    const failures = explainWrongGuess(puzzle, "11234"); // only 4 distinct
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain("5 distinct");
    expect(failures[0]).toContain("uses 4");
  });
});
