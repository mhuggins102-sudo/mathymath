import type { Clue } from "./types";

export const within2Clue: Clue<{ kind: "within2"; mask: boolean[] }> = {
  id: "within2",
  name: "Within 2",
  category: "positional",
  description:
    "Marks each slot where your digit is within 2 of the target digit (direction unknown).",
  weight: 1.0,
  compute(guess, target) {
    const mask = [...guess].map(
      (ch, i) => Math.abs(Number(ch) - Number(target[i])) <= 2,
    );
    return { kind: "within2", mask };
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
