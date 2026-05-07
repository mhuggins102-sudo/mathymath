import type { ClueResult } from "./clues/types";

/** Per-guess lock record: the player chose to "lock in" `digit` at
 *  `slot` before submitting. Correctness is authoritatively determined
 *  at submit time (by the state machine in unlimited mode or by the
 *  server in daily mode) and stored on the record. */
export interface LockRecord {
  slot: number;
  digit: string;
  correct: boolean;
}

/** Regular-mode starting lock count. Advanced mode begins with 0
 *  (the player can still gain a lock via the Extra Lock special). */
export const INITIAL_LOCKS = 1;

/** Resolves the starting-lock count for a game given its mode. */
export function initialLocksFor(advancedMode: boolean): number {
  return advancedMode ? 0 : INITIAL_LOCKS;
}

/** Locks can never exceed this. Extra Lock specials (including re-used
 *  Extra Locks via Clue Reuse) can add up to this cap. */
export const MAX_LOCKS = 3;

/** Clue id for the Extra Lock Special card. Kept here (not in the
 *  clues/ registry yet) so that the locks accounting code can count
 *  extra-lock gains from history even before Part 3 actually lands
 *  the clue. */
export const EXTRA_LOCK_CLUE_ID = "extraLock";

/** Clue id for the Clue Reuse Special card. Picking it costs one lock
 *  (reflected in the locksAvailable budget below) so it can't be used
 *  as a free repeat-info button. */
export const CLUE_REUSE_CLUE_ID = "clueReuse";

/** Lock cost paid by picking Clue Reuse. */
export const CLUE_REUSE_COST = 1;

export interface LockAccountingGuess {
  clueId?: string;
  result?: unknown;
  locks?: readonly LockRecord[];
  redraws?: number;
}

/** Total extra locks granted so far by Extra Lock clue picks. Also
 *  counts re-used Extra Locks via Clue Reuse (identified by
 *  result.kind being "extraLock" even though clueId is "clueReuse"). */
export function countExtraLocksGained(
  history: readonly LockAccountingGuess[],
): number {
  let n = 0;
  for (const g of history) {
    if (g.clueId === EXTRA_LOCK_CLUE_ID) {
      n++;
    } else if (
      g.clueId === "clueReuse" &&
      g.result &&
      typeof g.result === "object" &&
      (g.result as Record<string, unknown>).kind === EXTRA_LOCK_CLUE_ID
    ) {
      n++;
    }
  }
  return n;
}

/** Locks the player has remaining in this game, computed from the
 *  resolved history:
 *
 *    remaining = min(MAX_LOCKS, initialLocks + extraLocksGained)
 *                − (incorrect locks ever used)
 *                − (redraws spent)
 *                − (clueReuse picks × CLUE_REUSE_COST)
 *
 *  Correct locks don't count as spent — the player keeps them. */
export function locksAvailable(
  history: readonly LockAccountingGuess[],
  initialLocks: number = INITIAL_LOCKS,
): number {
  const cap = Math.min(
    MAX_LOCKS,
    initialLocks + countExtraLocksGained(history),
  );
  let spent = 0;
  for (const g of history) {
    for (const lock of g.locks ?? []) {
      if (!lock.correct) spent += 1;
    }
    // Each redraw (burn-lock-to-redraw) costs one lock.
    spent += g.redraws ?? 0;
    // Each Clue Reuse pick costs one lock. Counted whether or not the
    // re-used clue was a freebie like Extra Lock — the cost is for the
    // reuse action itself.
    if (g.clueId === CLUE_REUSE_CLUE_ID) spent += CLUE_REUSE_COST;
  }
  return Math.max(0, cap - spent);
}

/** Locks may be used on any guess. Kept as a function so call sites
 *  don't need to be touched if a per-turn restriction is reintroduced
 *  later. */
export function canUseLockOnGuess(): boolean {
  return true;
}

/** Derives the revealed target digits from past locks alone. Used by
 *  deriveCertainDigits to treat a correct lock as a certain digit going
 *  forward, same as Oracle / Bullseyes / etc. */
export function certainDigitsFromLocks(
  history: readonly { locks?: readonly LockRecord[] }[],
  digits: number,
): (string | null)[] {
  const out: (string | null)[] = new Array(digits).fill(null);
  for (const g of history) {
    for (const lock of g.locks ?? []) {
      if (lock.correct && lock.slot >= 0 && lock.slot < digits) {
        out[lock.slot] = lock.digit;
      }
    }
  }
  return out;
}

// Re-export ClueResult so callers can import one place.
export type { ClueResult };
