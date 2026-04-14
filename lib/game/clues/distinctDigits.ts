import type { Clue } from "./types";

export const distinctDigitsClue: Clue<{
  kind: "distinctDigits";
  count: number;
}> = {
  id: "distinctDigits",
  name: "Distinct Digits",
  category: "compositional",
  description:
    "Reveals how many different digit values appear in the target (1 = all repeats like 77777; 5 = all unique like 12345).",
  weight: 1.0,
  compute(guess, target) {
    return { kind: "distinctDigits", count: new Set(target).size };
  },
  example(target) {
    const guess = "0".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
