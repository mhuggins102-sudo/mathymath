import { describe, it, expect } from "vitest";
import {
  deriveCertainDigits,
  buildGuessFromInput,
  certainCount,
  inputCapacity,
} from "@/lib/game/certain";
import type { ClueResult } from "@/lib/game/clues/types";

const DIGITS = 5;

describe("deriveCertainDigits", () => {
  it("returns all null for empty history", () => {
    expect(deriveCertainDigits([], DIGITS)).toEqual([null, null, null, null, null]);
  });

  it("captures Bullseyes hit slots", () => {
    const r: ClueResult = {
      kind: "bullseyes",
      hits: [true, false, true, false, false],
    };
    expect(
      deriveCertainDigits(
        [{ guess: "12345", clueId: "bullseyes", result: r }],
        DIGITS,
      ),
    ).toEqual(["1", null, "3", null, null]);
  });

  it("captures Higher or Lower equal slots", () => {
    const r: ClueResult = {
      kind: "higherLower",
      cmp: ["lt", "eq", "gt", "eq", "gt"],
    };
    expect(
      deriveCertainDigits(
        [{ guess: "98765", clueId: "higherLower", result: r }],
        DIGITS,
      ),
    ).toEqual([null, "8", null, "6", null]);
  });

  it("captures Thermometer tier=0 slots", () => {
    const r: ClueResult = {
      kind: "thermometer",
      tier: [0, 2, 3, 0, 4],
    };
    expect(
      deriveCertainDigits(
        [{ guess: "13579", clueId: "thermometer", result: r }],
        DIGITS,
      ),
    ).toEqual(["1", null, null, "7", null]);
  });

  it("captures Oracle reveal (digit can differ from what player guessed)", () => {
    const r: ClueResult = {
      kind: "oracle",
      slot: 2,
      digit: 9,
    };
    // Player guessed 11111 but oracle reveals target[2] = 9.
    expect(
      deriveCertainDigits(
        [{ guess: "11111", clueId: "oracle", result: r }],
        DIGITS,
      ),
    ).toEqual([null, null, "9", null, null]);
  });

  it("accumulates knowledge across guesses", () => {
    const history = [
      {
        guess: "12345",
        clueId: "bullseyes" as const,
        result: {
          kind: "bullseyes" as const,
          hits: [true, false, false, false, false],
        },
      },
      {
        guess: "67890",
        clueId: "oracle" as const,
        result: { kind: "oracle" as const, slot: 3, digit: 4 },
      },
    ];
    expect(deriveCertainDigits(history, DIGITS)).toEqual([
      "1",
      null,
      null,
      "4",
      null,
    ]);
  });

  it("a correct lock reveals its slot", () => {
    const history = [
      {
        guess: "11111",
        clueId: "sumDelta" as const,
        result: { kind: "sumDelta" as const, delta: 0 },
        locks: [{ slot: 2, digit: "7", correct: true }],
      },
    ];
    expect(deriveCertainDigits(history, DIGITS)).toEqual([
      null,
      null,
      "7",
      null,
      null,
    ]);
  });

  it("an incorrect lock reveals nothing", () => {
    const history = [
      {
        guess: "11111",
        clueId: "sumDelta" as const,
        result: { kind: "sumDelta" as const, delta: 3 },
        locks: [{ slot: 2, digit: "7", correct: false }],
      },
    ];
    expect(deriveCertainDigits(history, DIGITS)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("non-revealing clues (Within 2, Parity Mask, compositional) leave all null", () => {
    const history = [
      {
        guess: "12345",
        clueId: "within2" as const,
        result: {
          kind: "within2" as const,
          mask: [true, true, true, true, true],
        },
      },
      {
        guess: "12345",
        clueId: "sumDelta" as const,
        result: { kind: "sumDelta" as const, delta: 5 },
      },
    ];
    expect(deriveCertainDigits(history, DIGITS)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("buildGuessFromInput", () => {
  it("interleaves certain + typed left-to-right", () => {
    // Slots 0, 3 certain = "5", "9". Typed fills the other three in order
    // (slots 1, 2, 4 get typed chars 2, 3, 4 respectively → 5,2,3,9,4).
    const certain = ["5", null, null, "9", null];
    expect(buildGuessFromInput(certain, "234")).toBe("52394");
  });

  it("returns a prefix when typed input is short", () => {
    const certain = ["5", null, null, "9", null];
    // Only 1 typed char so we stop after filling slot 1 and can't fill slot 2.
    expect(buildGuessFromInput(certain, "2")).toBe("52");
    expect(buildGuessFromInput(certain, "")).toBe("5");
  });

  it("handles no certain digits", () => {
    expect(buildGuessFromInput([null, null, null, null, null], "12345")).toBe(
      "12345",
    );
  });

  it("handles all certain", () => {
    expect(buildGuessFromInput(["1", "2", "3", "4", "5"], "")).toBe("12345");
  });
});

describe("certainCount + inputCapacity", () => {
  it("counts non-null slots", () => {
    expect(certainCount([null, null, null, null, null])).toBe(0);
    expect(certainCount(["1", null, "3", null, null])).toBe(2);
    expect(certainCount(["1", "2", "3", "4", "5"])).toBe(5);
  });
  it("inputCapacity is digits minus certain", () => {
    expect(inputCapacity([null, null, null, null, null])).toBe(5);
    expect(inputCapacity(["1", null, "3", null, null])).toBe(3);
    expect(inputCapacity(["1", "2", "3", "4", "5"])).toBe(0);
  });
});
