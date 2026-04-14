import type { Clue, Cmp } from "./types";

export const rangeCompareClue: Clue<{ kind: "rangeCompare"; cmp: Cmp }> = {
  id: "rangeCompare",
  name: "Range Compare",
  category: "compositional",
  description:
    "Is the target number (as a whole) higher, lower, or equal to your guess? Great for binary search.",
  weight: 1.0,
  compute(guess, target) {
    const t = Number(target);
    const g = Number(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "rangeCompare", cmp };
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
