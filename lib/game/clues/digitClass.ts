import type { Clue, Cmp } from "./types";

const PRIMES = new Set([2, 3, 5, 7]);

export function evenCount(s: string): number {
  let n = 0;
  for (const ch of s) if (Number(ch) % 2 === 0) n++;
  return n;
}

export function primeDigitCount(s: string): number {
  let n = 0;
  for (const ch of s) if (PRIMES.has(Number(ch))) n++;
  return n;
}

export function diceDigitCount(s: string): number {
  let n = 0;
  for (const ch of s) {
    const d = Number(ch);
    if (d >= 1 && d <= 6) n++;
  }
  return n;
}

function cmpOf(t: number, g: number): Cmp {
  return t === g ? "eq" : t > g ? "gt" : "lt";
}

/**
 * Digit Class — the digit-bucketing compositional clue. Returns three
 * comparisons of how many digits in the target fall into each class
 * vs the guess: even digits, prime digits (2/3/5/7), and dice digits
 * (1-6). Replaces the standalone Even Count, Prime Count, and Dice
 * Count clues with a single 3×3×3 = 27-outcome card.
 */
export const digitClassClue: Clue<{
  kind: "digitClass";
  evenCmp: Cmp;
  primeCmp: Cmp;
  diceCmp: Cmp;
}> = {
  id: "digitClass",
  name: "Digit Class",
  category: "compositional",
  description:
    "Three counts compared to your guess: even digits (0,2,4,6,8), prime digits (2,3,5,7), and dice digits (1-6).",
  weight: 1.0,
  legend: [
    { state: "match", label: "same count" },
    { state: "warm", label: "target has more" },
    { state: "cold", label: "target has fewer" },
  ],
  compute(guess, target) {
    return {
      kind: "digitClass",
      evenCmp: cmpOf(evenCount(target), evenCount(guess)),
      primeCmp: cmpOf(primeDigitCount(target), primeDigitCount(guess)),
      diceCmp: cmpOf(diceDigitCount(target), diceDigitCount(guess)),
    };
  },
  example(target) {
    const guess = "13579".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const e = evenCount(guess);
    const p = primeDigitCount(guess);
    const d = diceDigitCount(guess);
    const part = (label: string, cmp: Cmp, own: number): string => {
      if (cmp === "eq") return `${label} = ${own}`;
      if (cmp === "gt") return `${label} > ${own}`;
      return `${label} < ${own}`;
    };
    return [
      part("Even", result.evenCmp, e),
      part("Prime", result.primeCmp, p),
      part("Dice", result.diceCmp, d),
    ].join(" · ");
  },
};
