import type { Clue } from "./types";

/**
 * Oracle reveals a single slot of the target — but the slot is no
 * longer player-chosen. The clue auto-picks the slot where the
 * player's current guess is FARTHEST from the target (highest
 * |guess[i] - target[i]|), with leftmost-on-tie tiebreaking.
 *
 * Already-known slots have a delta of 0 by construction (the player
 * has the right digit there in their guess), so they're naturally
 * excluded from the maximum without explicit filtering.
 */
function pickFarthestSlot(guess: string, target: string): number {
  let bestSlot = 0;
  let bestDelta = -1;
  const n = Math.min(guess.length, target.length);
  for (let i = 0; i < n; i++) {
    const delta = Math.abs(Number(guess[i]) - Number(target[i]));
    if (delta > bestDelta) {
      bestDelta = delta;
      bestSlot = i;
    }
  }
  return bestSlot;
}

export const oracleClue: Clue<{ kind: "oracle"; slot: number; digit: number }> = {
  id: "oracle",
  name: "Oracle",
  category: "positional",
  description:
    "Reveals the target's digit at the slot where your guess is farthest from correct (leftmost on a tie).",
  weight: 0.9,
  legend: [{ state: "match", label: "revealed digit" }],
  compute(guess, target) {
    const slot = pickFarthestSlot(guess, target);
    return { kind: "oracle", slot, digit: Number(target[slot]) };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "0");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    return `The target's digit at slot ${result.slot + 1} is ${result.digit}.`;
  },
};
