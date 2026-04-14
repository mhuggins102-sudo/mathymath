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
    "A heat scale per slot showing how close your digit is to the target's digit.",
  weight: 0.8,
  legend: [
    { state: "match", label: "exact" },
    { state: "close", label: "within 1" },
    { state: "warm", label: "within 3" },
    { state: "cool", label: "within 5" },
    { state: "cold", label: "further off" },
  ],
  compute(guess, target) {
    const tiers = [...guess].map((ch, i) => tier(Number(ch) - Number(target[i])));
    return { kind: "thermometer", tier: tiers };
  },
  example(target) {
    // Try to cover all 5 tiers. For target "47628": "46371" hits
    //   exact / within 1 / within 3 / within 5 / far.
    // Generic fallback: offset each slot by increasing amounts.
    const offsets = [0, 1, 3, 5, 8];
    const guess = [...target]
      .map((ch, i) => {
        const d = Number(ch);
        const off = offsets[i] ?? 0;
        const v = d + off;
        return String(v > 9 ? d - off : v);
      })
      .join("");
    return { guess, result: this.compute(guess, target) };
  },
};
