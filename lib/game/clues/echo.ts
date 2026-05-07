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
    "For each slot in your guess, marks whether that digit appears in the target — multiset-aware. Each target digit can satisfy at most one guess slot (left-to-right), so a guess with three 4s when the target has two 4s lights up the first two only.",
  weight: 0.6,
  legend: [{ state: "warm", label: "digit appears in target" }],
  compute(guess, target) {
    // Multiset-aware: each occurrence of a digit in the target can
    // satisfy at most one matching slot in the guess. We walk the
    // guess left-to-right, marking a slot warm only while the
    // remaining count of that digit in the target is still positive,
    // then decrementing. Repeated guess digits beyond the target's
    // count stay idle — they're "wasted" duplicates, not extra hits.
    const remaining = new Map<string, number>();
    for (const ch of target)
      remaining.set(ch, (remaining.get(ch) ?? 0) + 1);
    const mask = [...guess].map((ch) => {
      const left = remaining.get(ch) ?? 0;
      if (left <= 0) return false;
      remaining.set(ch, left - 1);
      return true;
    });
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
