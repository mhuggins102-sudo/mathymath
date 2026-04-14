import type { Clue } from "./types";

function tier(diff: number): number {
  const d = Math.abs(diff);
  if (d === 0) return 0; // exact
  if (d <= 1) return 1; // within 1
  if (d <= 3) return 2; // within 3
  if (d <= 5) return 3; // within 5
  return 4; // far
}

export const thermometerClue: Clue<{ kind: "thermometer"; tier: number[] }> = {
  id: "thermometer",
  name: "Thermometer",
  category: "positional",
  description:
    "A heat scale per slot showing how close your digit is to the target's. Green = exact, teal = within 1, yellow = within 3, orange = within 5, red = further off.",
  weight: 0.8,
  compute(guess, target) {
    const tiers = [...guess].map((ch, i) => tier(Number(ch) - Number(target[i])));
    return { kind: "thermometer", tier: tiers };
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
