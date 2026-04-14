import type { Clue } from "./types";

function digitSum(s: string): number {
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  return sum;
}

export const sumDeltaClue: Clue<{ kind: "sumDelta"; delta: number }> = {
  id: "sumDelta",
  name: "Sum Delta",
  category: "compositional",
  description:
    "Exact signed difference between the target's digit sum and yours (target − guess).",
  weight: 0.9,
  legend: [
    { state: "match", label: "equal" },
    { state: "warm", label: "target higher" },
    { state: "cold", label: "target lower" },
  ],
  compute(guess, target) {
    return { kind: "sumDelta", delta: digitSum(target) - digitSum(guess) };
  },
  example(target) {
    const guess = "4".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const gs = digitSum(guess);
    const ts = gs + result.delta;
    if (result.delta === 0) return `Target's digit sum is ${ts} (same as yours).`;
    const sign = result.delta > 0 ? "+" : "−";
    return `Target's digit sum is ${ts} (yours is ${gs}, off by ${sign}${Math.abs(result.delta)}).`;
  },
};
