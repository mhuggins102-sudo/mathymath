import type { Clue } from "./types";

/**
 * Extra Lock — retired from the active deck on 2026-05-19, but kept
 * registered so legacy daily replays carrying `{ kind: "extraLock" }`
 * results still resolve. The "+1 lock when chosen" semantics now live
 * on three compositional clues (Distinct Digits, Ups and Downs,
 * Divisible By) via BONUS_LOCK_CLUE_IDS in locks.ts. Replays of older
 * daily games still grant +1 lock for each Extra Lock pick — the
 * legacy id is in BONUS_LOCK_CLUE_IDS too.
 */
export const extraLockClue: Clue<{ kind: "extraLock" }> = {
  id: "extraLock",
  name: "Extra Lock",
  category: "special",
  description:
    "+1 lock for the rest of the game. Costs you this round's clue.",
  // Medium frequency — common enough to feel learnable, rare enough
  // that every appearance is a real decision point. The registry's
  // "no duplicate clue ids per game" rule caps appearances at 1/game.
  weight: 1.0,
  legend: [{ state: "match", label: "+1 lock granted" }],
  compute() {
    return { kind: "extraLock" };
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain() {
    return "You gained an extra lock for the rest of the game.";
  },
};
