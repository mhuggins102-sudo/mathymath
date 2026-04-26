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
function formatMedian(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export const medianClue: Clue<{ kind: "median"; cmp: Cmp }> = {
  id: "median",
  name: "Median",
  category: "compositional",
  description:
    "Compares the median digit of your guess to the target's. With an even number of digits the median is the average of the two middle sorted digits.",
  weight: 1.1,
  legend: [
    { state: "match", label: "same median" },
    { state: "warm", label: "target higher" },
    { state: "cold", label: "target lower" },
  ],
  compute(guess, target) {
    const t = medianValue(target);
    const g = medianValue(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "median", cmp };
  },
  example(target) {
    const guess = "22222".slice(0, target.length).padEnd(target.length, "2");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = formatMedian(medianValue(guess));
    if (result.cmp === "eq") return `Target's median is ${g} (same as yours).`;
    if (result.cmp === "gt") return `Target's median is greater than ${g}.`;
    return `Target's median is less than ${g}.`;
  },
};
