import type { Clue } from "./types";
import { seededRng } from "../seededRng";

const DIVISORS = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Picks one value from 2-9 that divides the target and tells you that
 * divisor (yes). If no value from 2-9 divides the target (rare — means
 * the target has no prime factors ≤ 7, so it's either a prime > 7 or a
 * product of larger primes), the clue simply tells you that.
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
    "Picks one value between 2 and 9 that evenly divides the target (shown in the clue) and confirms it — e.g. '5? Yes'. If no value from 2 to 9 divides the target, shows 'Divisible? No'.",
  weight: 1.0,
  compute(guess, target) {
    const n = Number(target);
    const valid = DIVISORS.filter((d) => n % d === 0);
    if (valid.length === 0) {
      return { kind: "divisibleBy", divisor: null, present: false };
    }
    const rng = seededRng(`divisibleBy:${guess}:${target}`);
    const divisor = valid[Math.floor(rng() * valid.length)];
    return { kind: "divisibleBy", divisor, present: true };
  },
  example(target) {
    const guess = "36090".slice(0, target.length).padEnd(target.length, "3");
    return { guess, result: this.compute(guess, target) };
  },
};
