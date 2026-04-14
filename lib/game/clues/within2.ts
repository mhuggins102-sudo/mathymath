import type { Clue } from "./types";

export const within2Clue: Clue<{ kind: "within2"; mask: boolean[] }> = {
  id: "within2",
  name: "Within 2",
  category: "positional",
  description:
    "Marks each slot where your digit is within 2 of the target digit (direction unknown).",
  weight: 1.0,
  legend: [{ state: "match", label: "within ±2" }],
  compute(guess, target) {
    const mask = [...guess].map(
      (ch, i) => Math.abs(Number(ch) - Number(target[i])) <= 2,
    );
    return { kind: "within2", mask };
  },
  example(target) {
    // "55555" lands within ±2 of roughly the middle of the digit range —
    // gives a nice mix of marked and unmarked slots on most targets.
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
