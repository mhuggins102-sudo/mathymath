import type { Clue, Cmp } from "./types";

function cmp(target: number, guess: number): Cmp {
  if (target === guess) return "eq";
  return target > guess ? "gt" : "lt";
}

export const higherLowerClue: Clue<{ kind: "higherLower"; cmp: Cmp[] }> = {
  id: "higherLower",
  name: "Higher or Lower",
  category: "positional",
  description:
    "For each slot, shows whether your digit matches the target's, or whether the target's digit at that slot is higher or lower than yours.",
  weight: 0.6,
  legend: [
    { state: "match", label: "match" },
    { state: "warm", label: "target higher" },
    { state: "cold", label: "target lower" },
  ],
  compute(guess, target) {
    const out: Cmp[] = [];
    for (let i = 0; i < guess.length; i++) {
      out.push(cmp(Number(target[i]), Number(guess[i])));
    }
    return { kind: "higherLower", cmp: out };
  },
  example(target) {
    // Pick target's first digit + all 5s, so you usually see one match plus
    // a mix of "target higher" (warm) and "target lower" (cold) on the rest.
    const first = target[0] ?? "5";
    const guess = (first + "5555").slice(0, target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
