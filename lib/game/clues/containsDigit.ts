import type { Clue } from "./types";
import { seededRng } from "../seededRng";

/**
 * Asks whether a specific digit (seeded deterministically from the guess +
 * target) appears anywhere in the target. Same guess + target always asks
 * about the same digit, so daily play is fair.
 */
export const containsDigitClue: Clue<{
  kind: "containsDigit";
  digit: number;
  present: boolean;
}> = {
  id: "containsDigit",
  name: "Contains Digit",
  category: "compositional",
  description:
    "You pick a digit (0-9) — is it anywhere in the target? Yes or no.",
  // Single-bit yes/no clue. Weight kept above neutral so it shows up in
  // the chooser regularly (it's often the finisher late-game), but pulled
  // back from the top after simulations showed it dominating picks.
  weight: 1.2,
  paramKind: "digit",
  legend: [
    { state: "match", label: "digit present" },
    { state: "cold", label: "digit absent" },
  ],
  compute(guess, target, context) {
    // Player-selected: use the chosen digit directly.
    if (context?.selectedDigit !== undefined) {
      const digit = context.selectedDigit;
      const present = target.includes(String(digit));
      return { kind: "containsDigit", digit, present };
    }
    // Fallback (sim / tests / backward compat): random digit.
    const rng = seededRng(`contains:${guess}:${target}`);
    const digit = Math.floor(rng() * 10);
    const present = target.includes(String(digit));
    return { kind: "containsDigit", digit, present };
  },
  example(target) {
    const guess = "98765".slice(0, target.length).padEnd(target.length, "9");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    return result.present
      ? `The target contains at least one ${result.digit}.`
      : `The target does NOT contain the digit ${result.digit}.`;
  },
};
