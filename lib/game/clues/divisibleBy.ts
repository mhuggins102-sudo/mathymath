import type { Clue } from "./types";
import { seededRng } from "../seededRng";

const DIVISORS = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Picks one value from 2-9 that divides the target and tells you that
 * divisor (yes). If no value from 2-9 divides the target (rare), reports
 * that too.
 *
 * Determinism: the chosen divisor is seeded by (guess, target), so every
 * player who makes the same guess sees the same divisor.
 */
export const divisibleByClue: Clue<{
  kind: "divisibleBy";
  divisor: number | null;
  present: boolean;
}> = {
  id: "divisibleBy",
  name: "Divisible By",
  category: "compositional",
  description:
    "Picks one value between 2 and 9 that evenly divides the target (shown in the clue) and confirms it — e.g. '5? Yes'. If no value from 2 to 9 divides the target, reports no.",
  // Single-bit yes/no clue with narrative flavor ("divisible by 7? yes!").
  // Highest weight in the roster — it's the most-common filler clue.
  weight: 1.4,
  legend: [
    { state: "match", label: "divisible" },
    { state: "cold", label: "not divisible" },
  ],
  compute(guess, target, context) {
    const n = Number(target);
    const valid = DIVISORS.filter((d) => n % d === 0);
    if (valid.length === 0) {
      return { kind: "divisibleBy", divisor: null, present: false };
    }
    // When re-applied (via Clue Reuse) on a target that has multiple
    // valid divisors, prefer one the player hasn't seen yet — re-
    // revealing a divisor would convey no new information. Falls back
    // to the full set when every valid divisor has already been shown
    // (e.g. only one divisor matches in the first place).
    const revealed = new Set<number>();
    for (const r of context?.priorResults ?? []) {
      if (r.kind === "divisibleBy" && r.present && r.divisor !== null) {
        revealed.add(r.divisor);
      }
    }
    const fresh = valid.filter((d) => !revealed.has(d));
    const pool = fresh.length > 0 ? fresh : valid;
    const rng = seededRng(`divisibleBy:${guess}:${target}`);
    const divisor = pool[Math.floor(rng() * pool.length)];
    return { kind: "divisibleBy", divisor, present: true };
  },
  example(target) {
    const guess = "36090".slice(0, target.length).padEnd(target.length, "3");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    if (result.present && result.divisor !== null)
      return `Target is evenly divisible by ${result.divisor}.`;
    return "Target is not evenly divisible by any value from 2 to 9.";
  },
};
