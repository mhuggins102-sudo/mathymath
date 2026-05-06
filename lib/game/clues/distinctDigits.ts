import type { Clue } from "./types";

export const distinctDigitsClue: Clue<{
  kind: "distinctDigits";
  count: number;
}> = {
  id: "distinctDigits",
  name: "Distinct Overlap",
  category: "compositional",
  description:
    "Counts the distinct digit values that appear in BOTH your guess and the target. Maxes at min(distinct guess digits, distinct target digits).",
  // Medium-info; range tops at 5 (5-digit) or 6 (6-digit). Pivot weight.
  weight: 1.0,
  compute(guess, target) {
    const guessSet = new Set(guess);
    let count = 0;
    for (const d of new Set(target)) {
      if (guessSet.has(d)) count++;
    }
    return { kind: "distinctDigits", count };
  },
  example(target) {
    const guess = "24680".slice(0, target.length).padEnd(target.length, "2");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    return `${result.count} distinct digit value${result.count === 1 ? "" : "s"} appear${result.count === 1 ? "s" : ""} in both your guess and the target.`;
  },
};
