import type { Clue, ClueResult } from "./types";
import { getClueById } from "./registry";

/**
 * Clue Reuse — Special card. Lets the player pick any previously-used
 * clue and apply it again to the current guess. The resolved result is
 * the re-used clue's result (e.g. if Thermometer is re-used, the row
 * shows thermometer tiers). The clueId stored on the resolved guess is
 * "clueReuse", but `result.kind` matches the re-used clue.
 */
export const clueReuseClue: Clue<ClueResult> = {
  id: "clueReuse" as ClueResult["kind"],
  name: "Clue Reuse",
  category: "special",
  description:
    "Pick any clue you've already used this game and apply it again to your latest guess.",
  weight: 1.0,
  paramKind: "reuse",
  compute(guess, target, context) {
    if (!context?.reusedClueId) {
      // Fallback for example / sim where no re-used clue is specified.
      return { kind: "extraLock" } as ClueResult;
    }
    const reused = getClueById(context.reusedClueId as never);
    return reused.compute(guess, target, context);
  },
  example(target) {
    const guess = "5".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain() {
    return "You re-used a previous clue on this guess.";
  },
};
