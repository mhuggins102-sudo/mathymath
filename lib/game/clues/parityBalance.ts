import type { Clue, Cmp } from "./types";

function evenCount(s: string): number {
  let n = 0;
  for (const ch of s) if (Number(ch) % 2 === 0) n++;
  return n;
}

export const parityBalanceClue: Clue<{ kind: "parityBalance"; cmp: Cmp }> = {
  id: "parityBalance",
  name: "Parity Balance",
  category: "compositional",
  description:
    "Compares the number of even digits in the target to your guess. target ↑ means the target has more even digits than you do, target ↓ means fewer, equal means the same count.",
  weight: 1.2,
  compute(guess, target) {
    const t = evenCount(target);
    const g = evenCount(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "parityBalance", cmp };
  },
  example(target) {
    // All odd digits — shows a directional comparison on any target with
    // at least one even digit.
    const guess = "13579".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
};
