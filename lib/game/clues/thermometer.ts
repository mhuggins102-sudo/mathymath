import type { Clue } from "./types";

function tier(diff: number): number {
  // Tier 0 covers |diff| ≤ 1, NOT just exact matches: thermometer no
  // longer turns slots into certainty on its own (Bullseyes is the
  // canonical "this slot is exact" clue). Buckets are 0:≤1, 1:2-3,
  // 2:4-5, 3:≥6 — same 4-tier shape as before so saved-game JSON is
  // unchanged, but the meaning of tier 0 shifted.
  const d = Math.abs(diff);
  if (d <= 1) return 0;
  if (d <= 3) return 1;
  if (d <= 5) return 2;
  return 3;
}

const TIER_LABEL = ["within 1", "2-3 off", "4-5 off", "6+ off"];

export const thermometerClue: Clue<{ kind: "thermometer"; tier: number[] }> = {
  id: "thermometer",
  name: "Thermometer",
  category: "positional",
  description:
    "A heat scale per slot showing how close your digit is to the target's digit. The closest tier means within 1, NOT exact.",
  // 4 tiers × N slots. Weight matches higherLower so the two strongest
  // positional clues stay among the rarest draws.
  weight: 0.4,
  legend: [
    { state: "close", label: "within 1" },
    { state: "hint", label: "2-3 off" },
    { state: "warm", label: "4-5 off" },
    { state: "cold", label: "6+ off" },
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
