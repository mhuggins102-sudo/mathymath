import type { Clue } from "./types";

function evenCount(s: string): number {
  let n = 0;
  for (const ch of s) if (Number(ch) % 2 === 0) n++;
  return n;
}

export const parityBalanceClue: Clue<{ kind: "parityBalance"; match: boolean }> = {
  id: "parityBalance",
  name: "Parity Balance",
  category: "compositional",
  description:
    "Yes/no: does your guess have the same number of even digits as the target?",
  weight: 1.2,
  compute(guess, target) {
    return { kind: "parityBalance", match: evenCount(guess) === evenCount(target) };
  },
  example(target) {
    const guess = "0".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
