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
