import type { Clue } from "./types";

function tier(diff: number): number {
  // 3 tiers: tier 0 means |diff| ≤ 1, NOT just exact matches.
  // Bullseyes is the canonical "this slot is exact" clue; thermometer
  // no longer hands the player free certainty. Buckets are 0:0-1,
  // 1:2-3, 2:≥4.
  const d = Math.abs(diff);
  if (d <= 1) return 0;
  if (d <= 3) return 1;
  return 2;
}

const TIER_LABEL = ["0-1 off", "2-3 off", "4+ off"];

export const thermometerClue: Clue<{ kind: "thermometer"; tier: number[] }> = {
  id: "thermometer",
  name: "Thermometer",
  category: "positional",
  description:
    "A heat scale per slot showing how close your digit is to the target's digit. The closest tier means within 1 — slots are not revealed as exact.",
  // 3 tiers × N slots. Weight matches higherLower so the two strongest
  // positional clues stay among the rarest draws.
  weight: 0.4,
  legend: [
    { state: "close", label: "0-1 off" },
    { state: "warm", label: "2-3 off" },
    { state: "cold", label: "4+ off" },
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
