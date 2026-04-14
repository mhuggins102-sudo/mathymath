import type { Clue, Cmp } from "./types";

function maxDigit(s: string): number {
  return Math.max(...[...s].map(Number));
}

export const maxDigitClue: Clue<{ kind: "maxDigit"; cmp: Cmp }> = {
  id: "maxDigit",
  name: "Max Digit",
  category: "compositional",
  description:
    "Compares the largest digit in your guess to the target's largest.",
  weight: 0.9,
  legend: [
    { state: "match", label: "same max" },
    { state: "warm", label: "target max higher" },
    { state: "cold", label: "target max lower" },
  ],
  compute(guess, target) {
    const gMax = maxDigit(guess);
    const tMax = maxDigit(target);
    const cmp: Cmp = tMax === gMax ? "eq" : tMax > gMax ? "gt" : "lt";
    return { kind: "maxDigit", cmp };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = maxDigit(guess);
    if (result.cmp === "eq") return `Target's largest digit is ${g} (same as yours).`;
    if (result.cmp === "gt") return `Target's largest digit is greater than ${g}.`;
    return `Target's largest digit is less than ${g}.`;
  },
};
