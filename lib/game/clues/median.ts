import type { Clue, Cmp } from "./types";

function medianDigit(s: string): number {
  const sorted = [...s].map(Number).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export const medianClue: Clue<{ kind: "median"; cmp: Cmp }> = {
  id: "median",
  name: "Median",
  category: "compositional",
  description:
    "Compares the median digit (the middle digit when sorted) of your guess to the target's.",
  weight: 1.2,
  legend: [
    { state: "match", label: "same median" },
    { state: "warm", label: "target higher" },
    { state: "cold", label: "target lower" },
  ],
  compute(guess, target) {
    const t = medianDigit(target);
    const g = medianDigit(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "median", cmp };
  },
  example(target) {
    const guess = "22222".slice(0, target.length).padEnd(target.length, "2");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = medianDigit(guess);
    if (result.cmp === "eq") return `Target's median digit is ${g} (same as yours).`;
    if (result.cmp === "gt") return `Target's median digit is greater than ${g}.`;
    return `Target's median digit is less than ${g}.`;
  },
};
