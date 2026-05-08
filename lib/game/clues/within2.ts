import type { Clue } from "./types";

export const within2Clue: Clue<{
  kind: "within2";
  mask: boolean[];
  exact: boolean[];
}> = {
  id: "within2",
  name: "Within 2",
  category: "positional",
  description:
    "Marks each slot where your digit is within 2 of the target. Direction not given, exact matches not singled out.",
  weight: 0.8,
  legend: [{ state: "warm", label: "0-2 off" }],
  compute(guess, target) {
    const mask: boolean[] = [];
    const exact: boolean[] = [];
    for (let i = 0; i < guess.length; i++) {
      const diff = Math.abs(Number(guess[i]) - Number(target[i]));
      mask.push(diff <= 2);
      exact.push(diff === 0);
    }
    return { kind: "within2", mask, exact };
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    const slots = result.mask
      .map((m, i) => (m ? String(i + 1) : null))
      .filter((v): v is string => v !== null);
    if (slots.length === 0) return "No slots within ±2 of the target.";
    if (slots.length === result.mask.length)
      return "Every slot is within ±2 of the target.";
    return `Slots ${slots.join(", ")} are within ±2 of the target.`;
  },
};
