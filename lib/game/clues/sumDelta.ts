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
    "Shows the exact signed difference between the target's digit sum and your guess's digit sum (target − guess).",
  weight: 0.9,
  compute(guess, target) {
    return { kind: "sumDelta", delta: digitSum(target) - digitSum(guess) };
  },
  example(target) {
    const guess = "0".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
