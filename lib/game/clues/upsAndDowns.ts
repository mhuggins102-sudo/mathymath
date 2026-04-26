import type { Clue, Cmp } from "./types";

/**
 * Counts how many monotonic runs a digit string contains, reading left
 * to right. A "run" is a stretch of strictly increasing or strictly
 * decreasing digits; equal-adjacent pairs don't change the current
 * direction (so they neither start nor end a run).
 *
 *   "11111"  → 0 runs (no direction ever)
 *   "12345"  → 1 run  (all up)
 *   "24651"  → 2 runs (up, down)
 *   "20054"  → 3 runs (down, up, down)
 *
 * For an N-digit puzzle the value sits in 0..N-1 (0 only when every
 * digit repeats; otherwise at least 1).
 */
export function directionRuns(s: string): number {
  let count = 0;
  let lastDir: "up" | "down" | null = null;
  for (let i = 0; i < s.length - 1; i++) {
    const a = Number(s[i]);
    const b = Number(s[i + 1]);
    if (a === b) continue;
    const dir: "up" | "down" = b > a ? "up" : "down";
    if (dir !== lastDir) {
      count++;
      lastDir = dir;
    }
  }
  return count;
}

export const upsAndDownsClue: Clue<{ kind: "upsAndDowns"; cmp: Cmp }> = {
  id: "upsAndDowns",
  name: "Ups and Downs",
  category: "compositional",
  description:
    "Compares how many direction changes the target's digits make (left to right) to your guess. Example: 24651 has 2 (up then down); 20054 has 3 (down, up, down).",
  weight: 1.1,
  legend: [
    { state: "match", label: "same count" },
    { state: "warm", label: "target has more" },
    { state: "cold", label: "target has fewer" },
  ],
  compute(guess, target) {
    const t = directionRuns(target);
    const g = directionRuns(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "upsAndDowns", cmp };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = directionRuns(guess);
    if (result.cmp === "eq")
      return `Target has ${g} direction change${g === 1 ? "" : "s"}, same as yours.`;
    if (result.cmp === "gt")
      return `Target has more than ${g} direction change${g === 1 ? "" : "s"}.`;
    return `Target has fewer than ${g} direction change${g === 1 ? "" : "s"}.`;
  },
};
