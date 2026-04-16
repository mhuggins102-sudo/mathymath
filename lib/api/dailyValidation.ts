import type { ClueId, ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { knownSlotsFromHistory } from "@/lib/game/certain";
import {
  INITIAL_LOCKS,
  MAX_LOCKS,
  countExtraLocksGained,
  type LockRecord,
} from "@/lib/game/locks";

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
  locks?: Array<{
    slot: number;
    digit: string;
    correct: boolean;
  }>;
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

/** Per-guess lock validation: every claimed lock must match the real
 *  target's digit at its slot, and the per-guess attempts must be
 *  within the remaining lock budget at that point. */
function validateLocksForGuess(
  locks: NonNullable<IncomingGuess["locks"]>,
  target: string,
  digits: number,
  guessIndex: number,
  remainingLocks: number,
): string | null {
  if (locks.length === 0) return null;
  // Rule: no locks on guess 1 (zero-indexed).
  if (guessIndex === 0) return "locks_on_first_guess";
  // Per-lock structural checks first (dedupe / range / digit) so tests
  // and errors are deterministic regardless of budget state.
  const seenSlots = new Set<number>();
  for (const lock of locks) {
    if (lock.slot < 0 || lock.slot >= digits) return "lock_slot_out_of_range";
    if (!/^[0-9]$/.test(lock.digit)) return "lock_digit_invalid";
    if (seenSlots.has(lock.slot)) return "lock_duplicate_slot";
    seenSlots.add(lock.slot);
    const actuallyCorrect = target[lock.slot] === lock.digit;
    if (actuallyCorrect !== lock.correct) return "lock_correctness_mismatch";
  }
  // Rule: can't use more locks than the player has.
  if (locks.length > remainingLocks) return "locks_budget_exceeded";
  return null;
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
  // Track running lock budget — the cap grows as Extra Lock specials
  // are chosen, and shrinks as the player burns incorrect locks.
  let locksRemaining = INITIAL_LOCKS;

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

    // Validate any locks on this guess regardless of whether it's a win,
    // loss, or non-final wrong guess. The per-guess rules are the same.
    if (g.locks && g.locks.length > 0) {
      const lockError = validateLocksForGuess(
        g.locks,
        target,
        digits,
        i,
        locksRemaining,
      );
      if (lockError !== null) {
        return { ok: false, error: `${lockError}_at_${i}` };
      }
    }

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
      // Spend incorrect locks from the running budget.
      for (const lock of g.locks ?? []) {
        if (!lock.correct) locksRemaining -= 1;
      }
      status = "won";
      continue;
    }

    if (isFinalSlot) {
      // Final wrong guess: no clue allowed.
      if (g.clueId !== undefined) {
        return { ok: false, error: `final_wrong_guess_has_clue_at_${i}` };
      }
      for (const lock of g.locks ?? []) {
        if (!lock.correct) locksRemaining -= 1;
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
    // Context for clues that care about prior knowledge (Oracle today):
    // derived from all guesses BEFORE this one — same information the
    // client had when the clue resolved.
    const priorKnownSlots = knownSlotsFromHistory(
      history.slice(0, i) as Parameters<typeof knownSlotsFromHistory>[0],
      digits,
    );
    // For clues with paramKind (Oracle, Contains Digit): the player's
    // selection is encoded in the result itself. Oracle stores slot,
    // Contains Digit stores digit. Extract and pass so compute
    // reproduces the same result as the client claimed.
    const clueParam: Record<string, unknown> = {};
    if (g.result && typeof g.result === "object") {
      const r = g.result as Record<string, unknown>;
      if (r.kind === "oracle" && typeof r.slot === "number") {
        clueParam.selectedSlot = r.slot;
      }
      if (r.kind === "containsDigit" && typeof r.digit === "number") {
        clueParam.selectedDigit = r.digit;
      }
    }
    const expected = clue.compute(g.guess, target, {
      knownSlots: priorKnownSlots,
      ...clueParam,
    });
    if (!resultsMatch(g.result, expected)) {
      return { ok: false, error: `result_mismatch_at_${i}` };
    }
    chosenClueIds.push(g.clueId as ClueId);
    // Update running budget: Extra Lock grants +1 (capped at MAX_LOCKS);
    // incorrect locks used this turn spend the budget.
    const extraSoFar = countExtraLocksGained(
      history.slice(0, i + 1) as IncomingGuess[],
    );
    const cap = Math.min(MAX_LOCKS, INITIAL_LOCKS + extraSoFar);
    // Recompute remaining from cap + spent so we absorb any Extra Lock
    // just chosen.
    let spent = 0;
    for (let k = 0; k <= i; k++) {
      for (const lock of history[k].locks ?? []) {
        if (!lock.correct) spent += 1;
      }
    }
    locksRemaining = Math.max(0, cap - spent);
  }

  return { ok: true, status, chosenClueIds };
}

/** Resolve a fresh list of lock attempts against the real target. Used
 *  by the submit-guess endpoint to stamp correctness before returning. */
export function resolveLockAttempts(
  attempts: readonly { slot: number; digit: string }[],
  target: string,
): LockRecord[] {
  return attempts.map((a) => ({
    slot: a.slot,
    digit: a.digit,
    correct: target[a.slot] === a.digit,
  }));
}
