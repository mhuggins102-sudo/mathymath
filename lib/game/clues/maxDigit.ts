import type { Clue, Cmp } from "./types";

export const maxDigitClue: Clue<{ kind: "maxDigit"; cmp: Cmp }> = {
  id: "maxDigit",
  name: "Max Digit",
  category: "compositional",
  description:
    "Compares the largest digit in your guess to the largest digit in the target. target ↑ means the target's max is higher, target ↓ means lower, equal means the same.",
  weight: 0.9,
  compute(guess, target) {
    const gMax = Math.max(...[...guess].map(Number));
    const tMax = Math.max(...[...target].map(Number));
    const cmp: Cmp = tMax === gMax ? "eq" : tMax > gMax ? "gt" : "lt";
    return { kind: "maxDigit", cmp };
  },
  example(target) {
    // "12345" has max 5 — on most 5-digit targets that contain an 8 or 9
    // this shows "target ↑".
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
};
