import type { ClueId, ClueResult } from "@/lib/game/clues/types";
import {
  CAPTURED_DEDUCTION_PUZZLES,
  PUZZLES_BY_DIFFICULTY,
  type Difficulty,
} from "./captured";

export interface DeductionPuzzle {
  id: string;
  digits: number;
  target: string;
  guesses: Array<{
    guess: string;
    clueId: ClueId;
    result: ClueResult;
  }>;
  /** Composite difficulty score (higher = harder).
   *  unknownSlots*10 + log2(candidatesBeforeFinal)*3 + necessaryClueCount. */
  difficulty: number;
}

/** All sim-mined puzzles, sorted hardest → easiest. */
export const ALL_DEDUCTION_PUZZLES: DeductionPuzzle[] =
  CAPTURED_DEDUCTION_PUZZLES;

export type { Difficulty };

/** Pick a random puzzle from the chosen difficulty bucket
 *  ("easy" | "medium" | "hard" | "all"). When `excludeId` is provided
 *  (used by "Try another"), excludes that id from the pool unless doing
 *  so would leave the pool empty. */
export function pickDeductionPuzzle(
  difficulty: Difficulty = "all",
  excludeId?: string,
): DeductionPuzzle {
  const bucket = PUZZLES_BY_DIFFICULTY[difficulty];
  const pool = excludeId ? bucket.filter((p) => p.id !== excludeId) : bucket;
  const candidates = pool.length > 0 ? pool : bucket;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
