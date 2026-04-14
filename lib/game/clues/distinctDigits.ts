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
    const guess = "24680".slice(0, target.length).padEnd(target.length, "2");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    return `Target uses ${result.count} distinct digit value${result.count === 1 ? "" : "s"}.`;
  },
};
