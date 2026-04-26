import type { Clue } from "./types";

function tier(diff: number): number {
  const d = Math.abs(diff);
  if (d === 0) return 0;
  if (d <= 2) return 1;
  if (d <= 4) return 2;
  return 3;
}

const TIER_LABEL = ["exact", "1-2 off", "3-4 off", "5+ off"];

export const thermometerClue: Clue<{ kind: "thermometer"; tier: number[] }> = {
  id: "thermometer",
  name: "Thermometer",
  category: "positional",
  description:
    "A heat scale per slot showing how close your digit is to the target's digit.",
  // 4 tiers × N slots. Weight matches higherLower so the two strongest
  // positional clues stay among the rarest draws.
  weight: 0.4,
  legend: [
    { state: "match", label: "exact" },
    { state: "close", label: "1-2 off" },
    { state: "warm", label: "3-4 off" },
    { state: "cold", label: "5+ off" },
  ],
  compute(guess, target) {
    const tiers = [...guess].map((ch, i) => tier(Number(ch) - Number(target[i])));
    return { kind: "thermometer", tier: tiers };
  },
  example(target) {
    // Offsets chosen to cover all 4 tiers in the help-modal example.
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
  explain(_guess, result) {
    const counts = [0, 0, 0, 0];
    for (const t of result.tier) counts[t]++;
    const parts = counts
      .map((c, i) => (c > 0 ? `${c} ${TIER_LABEL[i]}` : null))
      .filter((v): v is string => v !== null);
    return parts.join(" · ");
  },
};
