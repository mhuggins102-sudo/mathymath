import type { Clue } from "./types";
import { seededRng } from "../seededRng";

export const oracleClue: Clue<{ kind: "oracle"; slot: number; digit: number }> = {
  id: "oracle",
  name: "Oracle",
  category: "positional",
  description:
    "You pick a slot — the target's exact digit there is revealed.",
  weight: 0.9,
  paramKind: "slot",
  legend: [{ state: "match", label: "revealed digit" }],
  compute(guess, target, context) {
    // Player-selected: use the chosen slot directly.
    if (context?.selectedSlot !== undefined) {
      const slot = context.selectedSlot;
      return { kind: "oracle", slot, digit: Number(target[slot]) };
    }
    // Fallback (sim / tests / backward compat): random pick excluding
    // already-known slots.
    const rng = seededRng(`oracle:${guess}:${target}`);
    const known = new Set<number>(context?.knownSlots ?? []);
    const pool: number[] = [];
    for (let i = 0; i < target.length; i++) {
      if (!known.has(i)) pool.push(i);
    }
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
