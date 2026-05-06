import type { Clue } from "./types";

function digitCounts(s: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const ch of s) out.set(ch, (out.get(ch) ?? 0) + 1);
  return out;
}

export const distinctDigitsClue: Clue<{
  kind: "distinctDigits";
  count: number;
  sharedRepeated: boolean[];
}> = {
  id: "distinctDigits",
  name: "Distinct Digits",
  category: "compositional",
  description:
    "Reveals how many different digit values appear in the target (1 = every slot is the same digit; up to the puzzle's length when every slot is unique). Also highlights any guess slots whose digit is repeated in BOTH your guess and the target.",
  // Medium-info; range tops at 5 (5-digit) or 6 (6-digit). Pivot weight.
  weight: 1.0,
  legend: [
    { state: "warm", label: "digit repeated in guess and target" },
  ],
  compute(guess, target) {
    const guessCounts = digitCounts(guess);
    const targetCounts = digitCounts(target);
    const sharedRepeated = [...guess].map(
      (ch) =>
        (guessCounts.get(ch) ?? 0) >= 2 && (targetCounts.get(ch) ?? 0) >= 2,
    );
    return {
      kind: "distinctDigits",
      count: new Set(target).size,
      sharedRepeated,
    };
  },
  example(target) {
    const guess = "24680".slice(0, target.length).padEnd(target.length, "2");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    return `Target uses ${result.count} distinct digit value${result.count === 1 ? "" : "s"}.`;
  },
};
