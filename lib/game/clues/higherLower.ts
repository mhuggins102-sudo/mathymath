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
    "For each slot, shows whether the target digit is higher (↑), lower (↓), or equal (✓) to your guess.",
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
