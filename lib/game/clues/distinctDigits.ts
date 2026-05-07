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
    // Highlight only the leftmost target_count occurrences of each
    // digit that's repeated in BOTH guess and target. Excess
    // duplicates beyond what the target carries stay idle so the
    // mask doesn't overcount.
    const remaining = new Map<string, number>();
    for (const [d, gc] of guessCounts) {
      const tc = targetCounts.get(d) ?? 0;
      if (gc >= 2 && tc >= 2) remaining.set(d, tc);
    }
    const sharedRepeated = [...guess].map((ch) => {
      const left = remaining.get(ch) ?? 0;
      if (left <= 0) return false;
      remaining.set(ch, left - 1);
      return true;
    });
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
