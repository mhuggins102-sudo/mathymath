import type { Clue } from "./types";

const PRIMES = new Set([2, 3, 5, 7]);

function primeDigitCount(s: string): number {
  let n = 0;
  for (const ch of s) if (PRIMES.has(Number(ch))) n++;
  return n;
}

export const primeCountClue: Clue<{ kind: "primeCount"; match: boolean }> = {
  id: "primeCount",
  name: "Prime Count",
  category: "compositional",
  description:
    "Yes/no: does your guess have the same number of prime digits (2, 3, 5, 7) as the target?",
  weight: 1.2,
  compute(guess, target) {
    return {
      kind: "primeCount",
      match: primeDigitCount(guess) === primeDigitCount(target),
    };
  },
  example(target) {
    const guess = "0".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
