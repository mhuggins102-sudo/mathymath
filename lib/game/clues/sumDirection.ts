import type { Clue, Cmp } from "./types";

function digitSum(s: string): number {
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  return sum;
}

export const sumDirectionClue: Clue<{ kind: "sumDirection"; cmp: Cmp }> = {
  id: "sumDirection",
  name: "Sum Direction",
  category: "compositional",
  description:
    "Is the target's digit sum higher, lower, or equal to your guess's? Direction only — no magnitude.",
  weight: 1.2,
  legend: [
    { state: "match", label: "equal" },
    { state: "warm", label: "target higher" },
    { state: "cold", label: "target lower" },
  ],
  compute(guess, target) {
    const t = digitSum(target);
    const g = digitSum(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "sumDirection", cmp };
  },
  example(target) {
    const guess = "4".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const gs = digitSum(guess);
    if (result.cmp === "eq") return `Target's digit sum equals ${gs} (same as yours).`;
    if (result.cmp === "gt") return `Target's digit sum is greater than ${gs}.`;
    return `Target's digit sum is less than ${gs}.`;
  },
};
