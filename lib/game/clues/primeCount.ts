import type { Clue, Cmp } from "./types";

const PRIMES = new Set([2, 3, 5, 7]);

function primeDigitCount(s: string): number {
  let n = 0;
  for (const ch of s) if (PRIMES.has(Number(ch))) n++;
  return n;
}

export const primeCountClue: Clue<{ kind: "primeCount"; cmp: Cmp }> = {
  id: "primeCount",
  name: "Prime Count",
  category: "compositional",
  description:
    "Compares the number of prime digits (2, 3, 5, 7) in the target to your guess. target ↑ means the target has more prime digits, target ↓ means fewer, equal means the same count.",
  weight: 1.2,
  compute(guess, target) {
    const t = primeDigitCount(target);
    const g = primeDigitCount(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "primeCount", cmp };
  },
  example(target) {
    // All prime digits (2,3,5,7) — likely more primes than the target.
    const guess = "23573".slice(0, target.length).padEnd(target.length, "2");
    return { guess, result: this.compute(guess, target) };
  },
};
