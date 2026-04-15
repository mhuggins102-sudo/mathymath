import type { Clue } from "./types";

export const totalDeviationClue: Clue<{
  kind: "totalDeviation";
  value: number;
}> = {
  id: "totalDeviation",
  name: "Total Deviation",
  category: "compositional",
  description:
    "The sum of per-slot absolute differences between your digits and the target's. 0 means every slot is exact; 45 is the worst possible (all digits maximally off).",
  // Medium-strong compositional clue (0..45 range). Overlaps thermometer
  // in what it measures (|t_i − g_i|) but collapses to a single number —
  // different feel, different pick rhythm, so it lives alongside.
  weight: 0.5,
  compute(guess, target) {
    let value = 0;
    for (let i = 0; i < guess.length; i++) {
      value += Math.abs(Number(guess[i]) - Number(target[i]));
    }
    return { kind: "totalDeviation", value };
  },
  example(target) {
    // "55555" lands somewhere in the middle of the digit range, so against
    // most targets this produces a meaningfully non-zero deviation.
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    if (result.value === 0)
      return "Your digits exactly match the target in every slot.";
    return `Your digits are off from the target's by ${result.value} in total across all slots.`;
  },
};
