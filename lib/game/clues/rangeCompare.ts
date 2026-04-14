import type { Clue, Cmp } from "./types";

function digitRange(s: string): number {
  const digits = [...s].map(Number);
  return Math.max(...digits) - Math.min(...digits);
}

export const rangeCompareClue: Clue<{ kind: "rangeCompare"; cmp: Cmp }> = {
  id: "rangeCompare",
  name: "Digit Range",
  category: "compositional",
  description:
    "Compares the range of digits (max − min) in your guess to the target's.",
  weight: 1.0,
  legend: [
    { state: "match", label: "same range" },
    { state: "warm", label: "target wider" },
    { state: "cold", label: "target narrower" },
  ],
  compute(guess, target) {
    const t = digitRange(target);
    const g = digitRange(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "rangeCompare", cmp };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = digitRange(guess);
    if (result.cmp === "eq") return `Target's digit range is ${g} (same as yours).`;
    if (result.cmp === "gt") return `Target's digit range is wider than ${g}.`;
    return `Target's digit range is narrower than ${g}.`;
  },
};
