import type { Clue, Cmp } from "./types";

/** Median of a digit string. Odd length → the middle sorted digit;
 *  even length → the average of the two middle sorted digits, which
 *  may be a non-integer (e.g. sorted [1,3,4,8] → 3.5). The cmp result
 *  is unaffected by integerness — compare-as-numbers either way. */
export function medianValue(s: string): number {
  const sorted = [...s].map(Number).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/** Renders a median value with at most one decimal place — keeps "5"
 *  as "5" and "3.5" as "3.5". */
export function formatMedian(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function digitRange(s: string): number {
  const ds = [...s].map(Number);
  return Math.max(...ds) - Math.min(...ds);
}

function cmpOf(t: number, g: number): Cmp {
  return t === g ? "eq" : t > g ? "gt" : "lt";
}

/**
 * Stat Summary — the box-and-whisker compositional clue. Returns two
 * comparisons: the target's median digit vs the guess's, and the
 * target's digit range (max−min) vs the guess's. Replaces the
 * standalone Median and Digit Range clues with a single richer card
 * (3×3 = 9 outcomes per round vs each clue's 3 outcomes alone).
 */
export const statSummaryClue: Clue<{
  kind: "statSummary";
  medianCmp: Cmp;
  rangeCmp: Cmp;
}> = {
  id: "statSummary",
  name: "Stat Summary",
  category: "compositional",
  description:
    "Two-line summary: how the target's median digit and digit range (max−min) compare to your guess's.",
  weight: 1.0,
  legend: [
    { state: "match", label: "same" },
    { state: "warm", label: "target higher / wider" },
    { state: "cold", label: "target lower / narrower" },
  ],
  compute(guess, target) {
    return {
      kind: "statSummary",
      medianCmp: cmpOf(medianValue(target), medianValue(guess)),
      rangeCmp: cmpOf(digitRange(target), digitRange(guess)),
    };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const m = formatMedian(medianValue(guess));
    const r = digitRange(guess);
    const mPart =
      result.medianCmp === "eq"
        ? `Median = ${m} (same).`
        : result.medianCmp === "gt"
          ? `Median > ${m}.`
          : `Median < ${m}.`;
    const rPart =
      result.rangeCmp === "eq"
        ? `Range = ${r} (same).`
        : result.rangeCmp === "gt"
          ? `Range > ${r}.`
          : `Range < ${r}.`;
    return `${mPart} ${rPart}`;
  },
};
