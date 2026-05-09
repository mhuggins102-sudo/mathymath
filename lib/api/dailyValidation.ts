import type { ClueId, ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { deriveCertainDigits, knownSlotsFromHistory } from "@/lib/game/certain";
import {
  CLUE_REUSE_CLUE_ID,
  CLUE_REUSE_COST,
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
  redraws?: number;
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
  remainingLocks: number,
): string | null {
  if (locks.length === 0) return null;
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
    // Validate redraws: each costs one lock.
    const roundRedraws = g.redraws ?? 0;
    if (roundRedraws > 0 && roundRedraws > locksRemaining) {
      return { ok: false, error: `redraw_budget_exceeded_at_${i}` };
    }

    if (g.locks && g.locks.length > 0) {
      const lockError = validateLocksForGuess(
        g.locks,
        target,
        digits,
        locksRemaining - roundRedraws,
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
    // Cumulative deck offset = sum of prior rounds' redraws + this
    // round's redraws. Each redraw advances the deck by one pair.
    let cumulativeRedraws = 0;
    for (let k = 0; k < i; k++) cumulativeRedraws += history[k].redraws ?? 0;
    cumulativeRedraws += g.redraws ?? 0;
    const offered = pickTwoClues(seed, chosenClueIds, cumulativeRedraws);
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
    const priorResults = history
      .slice(0, i)
      .map((h) => h.result as ClueResult | undefined)
      .filter((r): r is ClueResult => r !== undefined);
    const priorGuesses = history.slice(0, i).map((h) => h.guess);
    // For clues with paramKind (Oracle, Contains Digit): the player's
    // selection is encoded in the result itself. Oracle stores slot,
    // Oracle stores slot. For Clue Reuse: result.kind IS the reused
    // clue's id. Contains Digit's digit is now derived from
    // (guess, priorResults) inside its compute, so the validator
    // doesn't need to feed it back in — re-running compute reproduces
    // the same digit, and any client-supplied digit that differs will
    // surface via resultsMatch.
    const clueParam: Record<string, unknown> = {};
    if (g.result && typeof g.result === "object") {
      const r = g.result as Record<string, unknown>;
      // Oracle auto-picks its slot from (guess, target), so the
      // validator doesn't need to feed selectedSlot back in — the
      // re-computed slot will match the stored result, or
      // resultsMatch will fail.
      if (r.kind === "containsDigit" && Array.isArray(r.picks)) {
        clueParam.picks = (r.picks as Array<{ slot: number }>).map(
          (p) => p.slot,
        );
      }
      // Clue Reuse: the result carries the re-used clue's kind, which
      // we pass back as reusedClueId so compute delegates correctly.
      if (g.clueId === "clueReuse" && typeof r.kind === "string") {
        clueParam.reusedClueId = r.kind;
      }
    }
    const expected = clue.compute(g.guess, target, {
      knownSlots: priorKnownSlots,
      priorResults,
      priorGuesses,
      ...clueParam,
    });
    if (!resultsMatch(g.result, expected)) {
      return { ok: false, error: `result_mismatch_at_${i}` };
    }
    // Clue Reuse costs locks; reject the pick if the player couldn't
    // afford it at the moment of choice. "At pick" budget = locks the
    // player still has after this turn's wrong locks and redraws are
    // accounted for, but before the cost of the pick itself.
    if (g.clueId === CLUE_REUSE_CLUE_ID) {
      const wrongLocksThisTurn =
        (g.locks ?? []).filter((l) => !l.correct).length;
      const budgetAtPick =
        locksRemaining - wrongLocksThisTurn - roundRedraws;
      if (budgetAtPick < CLUE_REUSE_COST) {
        return { ok: false, error: `clue_reuse_no_budget_at_${i}` };
      }
    }
    chosenClueIds.push(g.clueId as ClueId);
    // Update running budget: Extra Lock grants +1 (capped at MAX_LOCKS);
    // incorrect locks + redraws + Clue Reuse picks all spend the budget.
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
      spent += history[k].redraws ?? 0;
      if (history[k].clueId === CLUE_REUSE_CLUE_ID) spent += CLUE_REUSE_COST;
    }
    locksRemaining = Math.max(0, cap - spent);
    // Oracle-induced win: if this guess's clue (Oracle, possibly via
    // Clue Reuse) revealed the last unknown slot, the player wins
    // here without needing to submit the now-known target.
    if (expected.kind === "oracle") {
      const certain = deriveCertainDigits(
        history.slice(0, i + 1) as Parameters<typeof deriveCertainDigits>[0],
        digits,
      );
      if (certain.every((d) => d !== null)) {
        status = "won";
      } else {
        // Also win when the player's guess at this row matched the
        // target at every slot except the Oracle slot — Oracle filled
        // the only mistake.
        const oracleSlot = expected.slot;
        const matchesElsewhere = [...g.guess].every(
          (ch, idx) => idx === oracleSlot || ch === target[idx],
        );
        if (matchesElsewhere) status = "won";
      }
    }
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
