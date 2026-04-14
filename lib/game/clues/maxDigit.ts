import type { Clue, Cmp } from "./types";

export const maxDigitClue: Clue<{ kind: "maxDigit"; cmp: Cmp }> = {
  id: "maxDigit",
  name: "Max Digit",
  category: "compositional",
  description:
    "Compares the largest digit in your guess to the largest digit in the target. Green = equal, yellow = target's max is higher, red = target's max is lower.",
  weight: 0.9,
  compute(guess, target) {
    const gMax = Math.max(...[...guess].map(Number));
    const tMax = Math.max(...[...target].map(Number));
    const cmp: Cmp = tMax === gMax ? "eq" : tMax > gMax ? "gt" : "lt";
    return { kind: "maxDigit", cmp };
  },
  example(target) {
    const guess = "0".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
