import type { Clue } from "./types";

/**
 * Extra Lock — the first "Special" card. Picking it costs you the
 * round's clue (no per-slot paint, no compositional intel) but grants
 * +1 lock for the rest of the game (see MAX_LOCKS in locks.ts).
 *
 * The +1 is NOT applied here; locks.ts derives the current budget from
 * history by counting Extra Lock picks (via EXTRA_LOCK_CLUE_ID) and
 * subtracting wrong-lock spends. compute() just produces a flat result
 * object so the rest of the clue pipeline (validator replay, share
 * text, resolved-row rendering) has something to round-trip.
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
