import type { Clue, Cmp } from "./types";

/** Median digit of the number (digits sorted; middle element). Works for any length. */
function medianDigit(s: string): number {
  const sorted = [...s].map(Number).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export const medianClue: Clue<{ kind: "median"; cmp: Cmp }> = {
  id: "median",
  name: "Median",
  category: "compositional",
  description:
    "Compares the median digit (the middle digit when you sort them) of your guess to the target's. target ↑ means the target's median is higher, target ↓ means lower, equal means the same.",
  weight: 1.0,
  compute(guess, target) {
    const t = medianDigit(target);
    const g = medianDigit(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "median", cmp };
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
