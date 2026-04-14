import type { Clue } from "./types";

export const bullseyesClue: Clue<{ kind: "bullseyes"; hits: boolean[] }> = {
  id: "bullseyes",
  name: "Bullseyes",
  category: "positional",
  description:
    "Marks each slot where your digit exactly matches the target digit in that slot.",
  weight: 1.0,
  compute(guess, target) {
    const hits = [...guess].map((ch, i) => ch === target[i]);
    return { kind: "bullseyes", hits };
  },
  example(target) {
    const guess = "0".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
