import type { ClueId, ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";

/**
 * Stateless replay-validator for a daily-game history.
 *
 * Given the authoritative `target` (which the client never sees during
 * play) and a client-submitted `history` of resolved guesses, walk the
 * history one step at a time and verify:
 *   1. every guess is the right length and digits-only
 *   2. exactly-matching guesses are flagged as a win
 *   3. final wrong guesses carry no clue (mirrors state machine)
 *   4. every non-final wrong guess's `clueId` was actually offered at
 *      that point (by re-running pickTwoClues with the path so far)
 *   5. every stored `result` matches what the real clue.compute would
 *      produce — this catches client tampering
 *
 * Returns the implied game status at the end of the history and the
 * list of chosen clue ids, which the caller needs to derive the next
 * clue pair.
 */

export interface IncomingGuess {
  guess: string;
  clueId?: string;
  result?: unknown;
}

export type ValidationResult =
  | { ok: true; status: "playing" | "won" | "lost"; chosenClueIds: ClueId[] }
  | { ok: false; error: string };

export interface ValidateParams {
  target: string;
  digits: number;
  maxGuesses: number;
  seed: string;
  history: readonly IncomingGuess[];
}

/** Deep-equal check over ClueResult shapes. The union values are all
 *  flat (primitives + boolean/number arrays) so JSON.stringify is a
 *  safe-enough equality. */
function resultsMatch(a: unknown, b: ClueResult): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function validateDailyHistory(
  params: ValidateParams,
): ValidationResult {
  const { target, digits, maxGuesses, seed, history } = params;
  if (history.length > maxGuesses) {
    return { ok: false, error: "history_too_long" };
  }

  const chosenClueIds: ClueId[] = [];
  let status: "playing" | "won" | "lost" = "playing";

  for (let i = 0; i < history.length; i++) {
    if (status !== "playing") {
      return { ok: false, error: `history_continues_after_terminal_at_${i}` };
    }
    const g = history[i];
    if (g.guess.length !== digits || !/^[0-9]+$/.test(g.guess)) {
      return { ok: false, error: `invalid_guess_at_${i}` };
    }

    const isExact = g.guess === target;
    const isFinalSlot = i + 1 >= maxGuesses;

    if (isExact) {
      // Exact match → auto-bullseyes, win. clueId (if present) must be
      // "bullseyes". result (if present) must match the real compute.
      if (g.clueId !== undefined && g.clueId !== "bullseyes") {
        return { ok: false, error: `win_with_non_bullseyes_at_${i}` };
      }
      const expected = getClueById("bullseyes").compute(g.guess, target);
      if (g.result !== undefined && !resultsMatch(g.result, expected)) {
        return { ok: false, error: `result_mismatch_at_${i}` };
      }
      status = "won";
      continue;
    }

    if (isFinalSlot) {
      // Final wrong guess: no clue allowed.
      if (g.clueId !== undefined) {
        return { ok: false, error: `final_wrong_guess_has_clue_at_${i}` };
      }
      status = "lost";
      continue;
    }

    // Non-final wrong guess: must have a valid clueId that was in the
    // offered pair, with a matching result.
    if (!g.clueId || g.result === undefined) {
      return { ok: false, error: `missing_clue_or_result_at_${i}` };
    }
    const offered = pickTwoClues(seed, chosenClueIds);
    const offeredIds = offered.map((c) => c.id);
    if (!offeredIds.includes(g.clueId as ClueId)) {
      return { ok: false, error: `clue_not_offered_at_${i}` };
    }
    const clue = getClueById(g.clueId as ClueId);
    const expected = clue.compute(g.guess, target);
    if (!resultsMatch(g.result, expected)) {
      return { ok: false, error: `result_mismatch_at_${i}` };
    }
    chosenClueIds.push(g.clueId as ClueId);
  }

  return { ok: true, status, chosenClueIds };
}
