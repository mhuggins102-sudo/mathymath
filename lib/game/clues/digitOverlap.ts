import type { Clue } from "./types";

function digitCounts(s: string): number[] {
  const c = new Array(10).fill(0);
  for (const ch of s) c[Number(ch)]++;
  return c;
}

export const digitOverlapClue: Clue<{ kind: "digitOverlap"; count: number }> = {
  id: "digitOverlap",
  name: "Digit Overlap",
  category: "compositional",
  description:
    "Counts how many digits you share with the target (ignoring position). Repeats count once per pair.",
  weight: 1.0,
  compute(guess, target) {
    const g = digitCounts(guess);
    const t = digitCounts(target);
    let count = 0;
    for (let i = 0; i < 10; i++) count += Math.min(g[i], t[i]);
    return { kind: "digitOverlap", count };
  },
  example(target) {
    const guess = "1".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
