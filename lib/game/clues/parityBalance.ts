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
    "Compares the number of even digits in the target to your guess.",
  weight: 1.2,
  legend: [
    { state: "match", label: "same count" },
    { state: "warm", label: "target has more" },
    { state: "cold", label: "target has fewer" },
  ],
  compute(guess, target) {
    const t = evenCount(target);
    const g = evenCount(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "parityBalance", cmp };
  },
  example(target) {
    const guess = "13579".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = evenCount(guess);
    if (result.cmp === "eq") return `Target has ${g} even digit${g === 1 ? "" : "s"} (same as yours).`;
    if (result.cmp === "gt") return `Target has more than ${g} even digit${g === 1 ? "" : "s"}.`;
    return `Target has fewer than ${g} even digit${g === 1 ? "" : "s"}.`;
  },
};
