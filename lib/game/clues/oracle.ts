import type { Clue } from "./types";
import { seededRng } from "../seededRng";

export const oracleClue: Clue<{ kind: "oracle"; slot: number; digit: number }> = {
  id: "oracle",
  name: "Oracle",
  category: "positional",
  description:
    "Reveals the exact target digit at one slot. The slot is picked pseudo-randomly from your guess and the target, so it's a bit of a gamble — but the same guess on the same puzzle will always reveal the same slot.",
  weight: 0.9,
  legend: [{ state: "match", label: "revealed digit" }],
  compute(guess, target, context) {
    const rng = seededRng(`oracle:${guess}:${target}`);
    // Exclude slots the player already knows (from prior clues /
    // correct locks) — re-revealing a known slot wastes the pick.
    // Determinism holds: two players with the same history reach the
    // same knownSlots set and draw the same slot.
    const known = new Set<number>(context?.knownSlots ?? []);
    const pool: number[] = [];
    for (let i = 0; i < target.length; i++) {
      if (!known.has(i)) pool.push(i);
    }
    // Defensive: if the caller somehow passed all slots as known, fall
    // back to the full slot range. In normal play the game is already
    // over before this happens.
    const candidates =
      pool.length > 0
        ? pool
        : Array.from({ length: target.length }, (_, i) => i);
    const slot = candidates[Math.floor(rng() * candidates.length)];
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
