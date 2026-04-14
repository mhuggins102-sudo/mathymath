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
    "For each slot: green if your digit matches the target, yellow if the target's digit at that slot is higher than yours (go up), red if it's lower (go down).",
  weight: 0.6,
  compute(guess, target) {
    const out: Cmp[] = [];
    for (let i = 0; i < guess.length; i++) {
      out.push(cmp(Number(target[i]), Number(guess[i])));
    }
    return { kind: "higherLower", cmp: out };
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
