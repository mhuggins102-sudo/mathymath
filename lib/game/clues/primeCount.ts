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
    "Compares the number of prime digits (2, 3, 5, 7) in the target to your guess.",
  weight: 1.2,
  legend: [
    { state: "match", label: "same count" },
    { state: "warm", label: "target has more" },
    { state: "cold", label: "target has fewer" },
  ],
  compute(guess, target) {
    const t = primeDigitCount(target);
    const g = primeDigitCount(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "primeCount", cmp };
  },
  example(target) {
    const guess = "23573".slice(0, target.length).padEnd(target.length, "2");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = primeDigitCount(guess);
    if (result.cmp === "eq") return `Target has ${g} prime digit${g === 1 ? "" : "s"} (same as yours).`;
    if (result.cmp === "gt") return `Target has more than ${g} prime digit${g === 1 ? "" : "s"}.`;
    return `Target has fewer than ${g} prime digit${g === 1 ? "" : "s"}.`;
  },
};
