import type { Clue } from "./types";

export const bullseyesClue: Clue<{ kind: "bullseyes"; hits: boolean[] }> = {
  id: "bullseyes",
  name: "Bullseyes",
  category: "positional",
  description:
    "Marks each slot where your digit exactly matches the target digit in that position.",
  weight: 1.0,
  legend: [{ state: "match", label: "exact match" }],
  compute(guess, target) {
    const hits = [...guess].map((ch, i) => ch === target[i]);
    return { kind: "bullseyes", hits };
  },
  example(target) {
    // Craft a guess with a mix: ~2 exact matches and ~3 misses.
    // Use target's 1st and 3rd digits, change the others.
    const t = [...target];
    const guess = [t[0], "3", t[2], "1", "9"].join("").slice(0, target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
