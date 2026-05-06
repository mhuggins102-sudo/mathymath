import type { Clue } from "./types";

/**
 * Echo — Wordle's yellow-tile mechanic. For each slot of the player's
 * guess, marks whether that digit appears anywhere in the target (not
 * necessarily at the same slot). Strong information density, so weight
 * is kept conservative.
 */
export const echoClue: Clue<{ kind: "echo"; mask: boolean[] }> = {
  id: "echo",
  name: "Echo",
  category: "compositional",
  description:
    "For each slot in your guess, marks whether that digit appears anywhere in the target — same idea as Wordle's yellow tiles. Doesn't tell you WHERE, just that the digit is present somewhere.",
  weight: 0.6,
  legend: [{ state: "warm", label: "digit appears in target" }],
  compute(guess, target) {
    const mask = [...guess].map((ch) => target.includes(ch));
    return { kind: "echo", mask };
  },
  example(target) {
    // Pick a guess that mixes some in-target digits with some absent
    // ones so the example shows a partial mask.
    const guess = ("0" + target).slice(0, target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    const slots = result.mask
      .map((m, i) => (m ? String(i + 1) : null))
      .filter((v): v is string => v !== null);
    if (slots.length === 0)
      return "None of your digits appear in the target.";
    if (slots.length === result.mask.length)
      return "Every digit in your guess appears somewhere in the target.";
    return `Slots ${slots.join(", ")} contain a digit that's somewhere in the target.`;
  },
};
