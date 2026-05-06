import type { Clue } from "./types";

/**
 * Elimination — the inverse of Echo. For each slot of the player's
 * guess, marks whether that digit is ABSENT from the target entirely.
 * Same per-position information as Echo but framed around what's
 * ruled out rather than what's still in play.
 */
export const eliminationClue: Clue<{ kind: "elimination"; mask: boolean[] }> = {
  id: "elimination",
  name: "Elimination",
  category: "compositional",
  description:
    "For each slot in your guess, marks whether that digit is ABSENT from the target entirely. Tells you which guess digits are wasted — don't reuse them.",
  weight: 0.6,
  legend: [{ state: "cold", label: "digit not in target" }],
  compute(guess, target) {
    const mask = [...guess].map((ch) => !target.includes(ch));
    return { kind: "elimination", mask };
  },
  example(target) {
    // Mix one absent digit into a target-derived guess so the
    // example shows a partial mask (one cold cell, rest idle).
    const guess = ("0" + target).slice(0, target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    const slots = result.mask
      .map((m, i) => (m ? String(i + 1) : null))
      .filter((v): v is string => v !== null);
    if (slots.length === 0)
      return "Every digit in your guess appears somewhere in the target.";
    if (slots.length === result.mask.length)
      return "None of your digits appear in the target.";
    return `Slots ${slots.join(", ")} contain a digit that's NOT in the target.`;
  },
};
