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

export function digitMin(s: string): number {
  let m = Infinity;
  for (const ch of s) {
    const d = Number(ch);
    if (d < m) m = d;
  }
  return Number.isFinite(m) ? m : 0;
}

export function digitMax(s: string): number {
  let m = -Infinity;
  for (const ch of s) {
    const d = Number(ch);
    if (d > m) m = d;
  }
  return Number.isFinite(m) ? m : 0;
}

function cmpOf(t: number, g: number): Cmp {
  return t === g ? "eq" : t > g ? "gt" : "lt";
}

/**
 * Stat Summary — the box-and-whisker compositional clue. Returns three
 * comparisons against your guess: median digit (the box's center),
 * smallest digit (lower whisker), and largest digit (upper whisker).
 * Replaces the standalone Median and Digit Range clues with one richer
 * card (3³ = 27 outcomes) — and trades the old "range" axis for two
 * independently-varying endpoints, which empirically slice the
 * candidate space better than the derived range.
 */
export const statSummaryClue: Clue<{
  kind: "statSummary";
  medianCmp: Cmp;
  minCmp: Cmp;
  maxCmp: Cmp;
}> = {
  id: "statSummary",
  name: "Stat Summary",
  category: "compositional",
  description:
    "Box-and-whisker comparison: how the target's median, smallest, and largest digits compare to your guess's.",
  weight: 1.0,
  legend: [
    { state: "match", label: "same" },
    { state: "warm", label: "target higher" },
    { state: "cold", label: "target lower" },
  ],
  compute(guess, target) {
    return {
      kind: "statSummary",
      medianCmp: cmpOf(medianValue(target), medianValue(guess)),
      minCmp: cmpOf(digitMin(target), digitMin(guess)),
      maxCmp: cmpOf(digitMax(target), digitMax(guess)),
    };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const med = formatMedian(medianValue(guess));
    const mn = digitMin(guess);
    const mx = digitMax(guess);
    const part = (label: string, cmp: Cmp, own: string | number): string => {
      if (cmp === "eq") return `${label} = ${own} (same)`;
      if (cmp === "gt") return `${label} > ${own}`;
      return `${label} < ${own}`;
    };
    return [
      part("Median", result.medianCmp, med),
      part("Min", result.minCmp, mn),
      part("Max", result.maxCmp, mx),
    ].join(" · ");
  },
};
