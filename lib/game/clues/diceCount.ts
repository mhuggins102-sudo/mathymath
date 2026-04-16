import type { Clue, Cmp } from "./types";

function diceDigitCount(s: string): number {
  let n = 0;
  for (const ch of s) {
    const d = Number(ch);
    if (d >= 1 && d <= 6) n++;
  }
  return n;
}

export const diceCountClue: Clue<{ kind: "diceCount"; cmp: Cmp }> = {
  id: "diceCount",
  name: "Dice Count",
  category: "compositional",
  description:
    "Compares the number of standard die-face digits (1–6) in your guess to the target's.",
  weight: 1.2,
  legend: [
    { state: "match", label: "same count" },
    { state: "warm", label: "target has more" },
    { state: "cold", label: "target has fewer" },
  ],
  compute(guess, target) {
    const t = diceDigitCount(target);
    const g = diceDigitCount(guess);
    const cmp: Cmp = t === g ? "eq" : t > g ? "gt" : "lt";
    return { kind: "diceCount", cmp };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    const g = diceDigitCount(guess);
    if (result.cmp === "eq")
      return `Target has ${g} die-face digit${g === 1 ? "" : "s"} (1–6), same as yours.`;
    if (result.cmp === "gt")
      return `Target has more than ${g} die-face digit${g === 1 ? "" : "s"} (1–6).`;
    return `Target has fewer than ${g} die-face digit${g === 1 ? "" : "s"} (1–6).`;
  },
};
