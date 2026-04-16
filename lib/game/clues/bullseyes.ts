import type { Clue } from "./types";

export const bullseyesClue: Clue<{ kind: "bullseyes"; hits: boolean[] }> = {
  id: "bullseyes",
  name: "Bullseye",
  category: "positional",
  description:
    "Marks each slot where your digit exactly matches the target digit in that position.",
  weight: 0.7,
  legend: [{ state: "match", label: "exact match" }],
  compute(guess, target) {
    const hits = [...guess].map((ch, i) => ch === target[i]);
    return { kind: "bullseyes", hits };
  },
  example(target) {
    const t = [...target];
    const guess = [t[0], "3", t[2], "1", "9"].join("").slice(0, target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    const slots = result.hits
      .map((h, i) => (h ? String(i + 1) : null))
      .filter((v): v is string => v !== null);
    if (slots.length === 0) return "No slots match the target exactly.";
    if (slots.length === 1) return `Slot ${slots[0]} matches the target exactly.`;
    return `Slots ${slots.join(", ")} match the target exactly.`;
  },
};
