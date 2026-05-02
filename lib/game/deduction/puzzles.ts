import type { ClueId, ClueResult } from "@/lib/game/clues/types";

export interface DeductionPuzzle {
  id: string;
  digits: number;
  target: string;
  guesses: Array<{
    guess: string;
    clueId: ClueId;
    result: ClueResult;
  }>;
  /** Two-sentence explanation shown when the player guesses wrong. */
  explanation: string;
}

export const DEDUCTION_PUZZLES: DeductionPuzzle[] = [
  {
    id: "d1",
    digits: 5,
    target: "47396",
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
    explanation:
      "Bullseyes confirmed the first four digits are 4, 7, 3, 9. A Sum Delta of +1 from 47395 means the target is exactly 1 higher, so the last digit is 6.",
  },
  {
    id: "d2",
    digits: 5,
    target: "64827",
    guesses: [
      {
        guess: "64820",
        clueId: "higherLower",
        result: { kind: "higherLower", cmp: ["eq", "eq", "eq", "eq", "gt"] },
      },
      {
        guess: "64824",
        clueId: "sumDelta",
        result: { kind: "sumDelta", delta: 3 },
      },
    ],
    explanation:
      "Higher or Lower confirmed the first four digits are exactly 6, 4, 8, 2. A Sum Delta of +3 from 64824 means the target is 64824 + 3 = 64827, so the last digit is 7.",
  },
  {
    id: "d3",
    digits: 5,
    target: "39152",
    guesses: [
      {
        guess: "39151",
        clueId: "thermometer",
        result: { kind: "thermometer", tier: [0, 0, 0, 0, 1] },
      },
      {
        guess: "39153",
        clueId: "sumDelta",
        result: { kind: "sumDelta", delta: -1 },
      },
    ],
    explanation:
      "The Thermometer showed exact matches (tier 0) for the first four digits 3, 9, 1, 5. A Sum Delta of -1 from 39153 means the target is 1 less, so the last digit is 2.",
  },
  {
    id: "d4",
    digits: 5,
    target: "52834",
    guesses: [
      {
        guess: "12834",
        clueId: "bullseyes",
        result: { kind: "bullseyes", hits: [false, true, true, true, true] },
      },
      {
        guess: "32834",
        clueId: "containsDigit",
        result: { kind: "containsDigit", digit: 5, present: true },
      },
    ],
    explanation:
      "Bullseyes confirmed positions 2–5 are 2, 8, 3, 4. The Contains Digit clue revealed that 5 is somewhere in the target — since the only unknown position is the first, the first digit must be 5.",
  },
  {
    id: "d5",
    digits: 5,
    target: "25849",
    guesses: [
      {
        guess: "50000",
        clueId: "higherLower",
        result: { kind: "higherLower", cmp: ["lt", "gt", "gt", "gt", "gt"] },
      },
      {
        guess: "25840",
        clueId: "higherLower",
        result: { kind: "higherLower", cmp: ["eq", "eq", "eq", "eq", "gt"] },
      },
      {
        guess: "25845",
        clueId: "sumDelta",
        result: { kind: "sumDelta", delta: 4 },
      },
    ],
    explanation:
      "Higher or Lower confirmed the first four digits are exactly 2, 5, 8, 4, with the last digit above 0. A Sum Delta of +4 from 25845 means the target is 25845 + 4 = 25849.",
  },
];

/** Pick a random puzzle, excluding `excludeId` when possible (for "Try another"). */
export function pickDeductionPuzzle(excludeId?: string): DeductionPuzzle {
  const pool = excludeId
    ? DEDUCTION_PUZZLES.filter((p) => p.id !== excludeId)
    : DEDUCTION_PUZZLES;
  const candidates = pool.length > 0 ? pool : DEDUCTION_PUZZLES;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
