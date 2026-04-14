import type { Clue, Cmp } from "./types";

function digitRange(s: string): number {
  const digits = [...s].map(Number);
  return Math.max(...digits) - Math.min(...digits);
}

export const rangeCompareClue: Clue<{ kind: "rangeCompare"; cmp: Cmp }> = {
  id: "rangeCompare",
  name: "Digit Range",
  category: "compositional",
  description:
    "Compares the range of digits (largest − smallest) in your guess to the target's. target ↑ means the target spans a wider range of digits, target ↓ means narrower, equal means the same spread.",
  weight: 1.0,
  compute(guess, target) {
    const t = digitRange(target);
    const g = digitRange(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "rangeCompare", cmp };
  },
  example(target) {
    // "12345" has range 4 — narrower than most 5-digit targets.
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
};
