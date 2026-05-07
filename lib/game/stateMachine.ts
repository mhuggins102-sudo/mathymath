import type { Clue, ClueId, ClueParam, ClueResult } from "./clues/types";
import { getClueById } from "./clues/registry";
import {
  buildPreselectedDeck,
  pickTwoClues,
} from "./clueSelector";
import { deriveCertainDigits, knownSlotsFromHistory } from "./certain";
import type { LockRecord } from "./locks";

export const DEFAULT_MAX_GUESSES = 7;

/** Per-digit-count guess budgets. Both 5- and 6-digit games get 7
 *  tries — the 6-digit puzzle is harder by design without an extended
 *  budget. Returns DEFAULT_MAX_GUESSES for any unlisted digit count. */
export const MAX_GUESSES_BY_DIGITS: Readonly<Record<number, number>> = {
  5: 7,
  6: 7,
};

export function maxGuessesForDigits(digits: number): number {
  return MAX_GUESSES_BY_DIGITS[digits] ?? DEFAULT_MAX_GUESSES;
}

export type GameStatus = "playing" | "won" | "lost";

/**
 * A resolved guess row. `clueId` and `result` are present whenever the
 * player chose a clue. They are undefined for the final guess of a lost
 * game (because no clue is offered on guess #maxGuesses — the game ends
 * immediately on that submission).
 *
 * `locks` records slots the player chose to "lock in" before submitting,
 * with per-slot correctness resolved against the real target. Absent on
 * guesses without any locks.
 */
export interface ResolvedGuess {
  guess: string;
  clueId?: ClueId;
  result?: ClueResult;
  locks?: LockRecord[];
  /** How many times the player burned a lock to redraw the offered pair
   *  on this round (0 = no redraws). Affects deck pointer + lock budget. */
  redraws?: number;
}

/** A lock the player committed before submit, sans correctness — the
 *  reducer resolves correctness against the real target and promotes
 *  the attempt to a full LockRecord in the stored history. */
export interface LockAttempt {
  slot: number;
  digit: string;
}

export interface GameState {
  target: string;
  digits: number;
  maxGuesses: number;
  seed: string;
  guesses: ResolvedGuess[];
  /** Cumulative deck-position offset caused by redraws across all
   *  prior rounds. Used by pickTwoClues to advance past consumed
   *  pairs. Starts at 0; each REDRAW bumps by 1. */
  deckOffset: number;
  /** Every clue id ever offered to the player in this game (both
   *  picked and unpicked options across all pairs, including those
   *  burned via redraws). Passed to pickTwoClues as a soft exclusion
   *  so the walk-forward / backfill paths can't re-surface a card the
   *  player has already seen — the bug this prevents shows up in
   *  advanced mode after the positional cap, where filtering positional
   *  cards out of the walk burns extra deck positions that would
   *  otherwise leak forward into the next pair's region. */
  offeredClueIds: ClueId[];
  /** "Advanced" rules toggle, captured at game start. Setting changes
   *  during a game don't affect the in-progress reducer — only the next
   *  RESET picks up the new flag. Daily mode never enables this. */
  advancedMode: boolean;
  /** Pre-dealt clue deck for "Preselected Clues" mode. When non-null,
   *  guess N consumes deck[N] — no chooser, no redraw. Length is
   *  maxGuesses-1 (the final guess gets no clue). null in normal mode. */
  preselectedDeck: ClueId[] | null;
  /** Current pending guess waiting for the player to choose a clue.
   *  `locks` travels with the pending guess so the chosen clue handler
   *  can append them to the resolved history alongside the clue result.
   *  In preselected mode, this is only set when the pre-assigned clue
   *  has a paramKind (currently only oracle) — `options` is then
   *  `[clue, clue]` (the same clue twice) so existing consumers work
   *  unchanged; the chooser UI is suppressed. */
  pendingGuess: {
    guess: string;
    options: [Clue, Clue];
    locks?: LockRecord[];
    redraws: number;
  } | null;
  status: GameStatus;
}

export type GameAction =
  | { type: "SUBMIT_GUESS"; guess: string; locks?: readonly LockAttempt[] }
  | { type: "CHOOSE_CLUE"; clueId: ClueId; param?: ClueParam }
  | { type: "REDRAW" }
  | {
      type: "RESET";
      target: string;
      seed: string;
      digits?: number;
      maxGuesses?: number;
      advancedMode?: boolean;
      preselectedClues?: boolean;
    };

export function initGameState(params: {
  target: string;
  seed: string;
  digits?: number;
  maxGuesses?: number;
  advancedMode?: boolean;
  preselectedClues?: boolean;
}): GameState {
  const maxGuesses = params.maxGuesses ?? DEFAULT_MAX_GUESSES;
  const preselectedDeck = params.preselectedClues
    ? buildPreselectedDeck(
        params.seed,
        // One clue per guess except the final one, which never gets a clue.
        Math.max(0, maxGuesses - 1),
        params.advancedMode ?? false,
      )
    : null;
  return {
    target: params.target,
    seed: params.seed,
    digits: params.digits ?? params.target.length,
    maxGuesses,
    guesses: [],
    deckOffset: 0,
    offeredClueIds: [],
    advancedMode: params.advancedMode ?? false,
    preselectedDeck,
    pendingGuess: null,
    status: "playing",
  };
}

export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "RESET":
      return initGameState({
        target: action.target,
        seed: action.seed,
        digits: action.digits,
        maxGuesses: action.maxGuesses,
        advancedMode: action.advancedMode,
        preselectedClues: action.preselectedClues,
      });

    case "SUBMIT_GUESS": {
      if (state.status !== "playing" || state.pendingGuess) return state;
      if (action.guess.length !== state.digits) return state;

      // Resolve any lock attempts against the real target. Stored on the
      // guess only when there actually were attempts; otherwise we leave
      // `locks` undefined so existing rows don't gain an empty array.
      const attempts = action.locks ?? [];
      const resolvedLocks: LockRecord[] = attempts.map((l) => ({
        slot: l.slot,
        digit: l.digit,
        correct: state.target[l.slot] === l.digit,
      }));
      const locksField =
        resolvedLocks.length > 0 ? { locks: resolvedLocks } : {};

      // Exact match = instant win; skip clue-choice modal.
      if (action.guess === state.target) {
        const clueId: ClueId = "bullseyes";
        const result = getClueById(clueId).compute(action.guess, state.target);
        return {
          ...state,
          guesses: [
            ...state.guesses,
            { guess: action.guess, clueId, result, ...locksField },
          ],
          status: "won",
        };
      }

      // Final guess and wrong → lose immediately without offering a clue.
      // (Showing a clue right before the game ends would be pointless.)
      const isFinalGuess = state.guesses.length + 1 >= state.maxGuesses;
      if (isFinalGuess) {
        return {
          ...state,
          guesses: [
            ...state.guesses,
            { guess: action.guess, ...locksField },
          ],
          status: "lost",
        };
      }

      // Preselected-clues mode: consume the next clue from the pre-
      // dealt deck. No chooser. If the clue has paramKind, we set
      // pendingGuess (with options=[clue,clue] so existing consumers
      // see a 2-element tuple) and let the param picker run; otherwise
      // resolve immediately and append the row.
      if (state.preselectedDeck) {
        const clueId = state.preselectedDeck[state.guesses.length];
        const clue = getClueById(clueId);
        if (clue.paramKind) {
          return {
            ...state,
            offeredClueIds: appendOfferedIds(state.offeredClueIds, [clue]),
            pendingGuess: {
              guess: action.guess,
              // Duplicate the clue so the [Clue, Clue] tuple shape stays
              // valid. The chooser UI is suppressed in preselected mode
              // so this is never actually rendered to the player.
              options: [clue, clue],
              redraws: 0,
              ...(resolvedLocks.length > 0 ? { locks: resolvedLocks } : {}),
            },
          };
        }
        const knownSlots = knownSlotsFromHistory(state.guesses, state.digits);
        const priorResults = state.guesses
          .map((g) => g.result)
          .filter((r): r is NonNullable<typeof r> => r !== undefined);
        const priorGuesses = state.guesses.map((g) => g.guess);
        const result = clue.compute(action.guess, state.target, {
          knownSlots,
          priorResults,
          priorGuesses,
        });
        const guesses = [
          ...state.guesses,
          {
            guess: action.guess,
            clueId: clue.id,
            result,
            ...locksField,
          },
        ];
        const lost = guesses.length >= state.maxGuesses;
        return {
          ...state,
          offeredClueIds: appendOfferedIds(state.offeredClueIds, [clue]),
          guesses,
          status: lost ? "lost" : "playing",
        };
      }

      const usedClueIds = state.guesses
        .map((g) => g.clueId)
        .filter((id): id is ClueId => id !== undefined);
      const excludeIds = new Set(state.offeredClueIds);
      const options = pickTwoClues(
        state.seed,
        usedClueIds,
        state.deckOffset,
        state.advancedMode,
        excludeIds,
      );
      return {
        ...state,
        offeredClueIds: appendOfferedIds(state.offeredClueIds, options),
        pendingGuess: {
          guess: action.guess,
          options,
          redraws: 0,
          ...(resolvedLocks.length > 0 ? { locks: resolvedLocks } : {}),
        },
      };
    }

    case "REDRAW": {
      if (!state.pendingGuess) return state;
      // Preselected mode has no chooser, so redraw is meaningless.
      if (state.preselectedDeck) return state;
      // Lock budget check is the caller's responsibility (the hook
      // gates the redraw button). The reducer just advances the deck.
      const newOffset = state.deckOffset + 1;
      const usedClueIds = state.guesses
        .map((g) => g.clueId)
        .filter((id): id is ClueId => id !== undefined);
      const excludeIds = new Set(state.offeredClueIds);
      const newOptions = pickTwoClues(
        state.seed,
        usedClueIds,
        newOffset,
        state.advancedMode,
        excludeIds,
      );
      return {
        ...state,
        deckOffset: newOffset,
        offeredClueIds: appendOfferedIds(state.offeredClueIds, newOptions),
        pendingGuess: {
          ...state.pendingGuess,
          options: newOptions,
          redraws: state.pendingGuess.redraws + 1,
        },
      };
    }

    case "CHOOSE_CLUE": {
      if (!state.pendingGuess) return state;
      const { guess, options, locks } = state.pendingGuess;
      const clue = options.find((c) => c.id === action.clueId);
      if (!clue) return state;
      // Oracle (and any future context-aware clue) gets the slots
      // already known BEFORE this guess resolves. Prior-guess history
      // is authoritative; the pending guess isn't yet committed.
      const knownSlots = knownSlotsFromHistory(
        state.guesses,
        state.digits,
      );
      const priorResults = state.guesses
        .map((g) => g.result)
        .filter((r): r is NonNullable<typeof r> => r !== undefined);
      const priorGuesses = state.guesses.map((g) => g.guess);
      const result = clue.compute(guess, state.target, {
        knownSlots,
        priorResults,
        priorGuesses,
        ...action.param,
      });
      const { redraws } = state.pendingGuess;
      const guesses = [
        ...state.guesses,
        {
          guess,
          clueId: clue.id,
          result,
          ...(locks && locks.length > 0 ? { locks } : {}),
          ...(redraws > 0 ? { redraws } : {}),
        },
      ];
      const won = guess === state.target;
      // Oracle-induced win: when the chosen clue's result reveals the
      // last unknown slot (combined with prior reveals + correct locks),
      // the player has effectively solved the puzzle. They shouldn't be
      // forced to type the now-known target on a subsequent guess.
      // Triggered on result.kind === "oracle" so it also fires when
      // Oracle is reached via Clue Reuse (clueId is "clueReuse" but
      // result.kind is the reused clue's id).
      let oracleWon = false;
      if (!won && result.kind === "oracle") {
        const certain = deriveCertainDigits(guesses, state.digits);
        if (certain.every((d) => d !== null)) oracleWon = true;
        // Also win if the player's current guess matches the target
        // at every slot except the Oracle slot — Oracle just filled
        // in the only mistake, and forcing the player to re-enter the
        // same digits to commit the win is wasteful. This handles the
        // case where the player has a near-correct guess but no locks
        // at the matching slots, so deriveCertainDigits doesn't count
        // them as known.
        if (!oracleWon) {
          const oracleSlot = result.slot;
          const matchesElsewhere = [...guess].every(
            (ch, i) => i === oracleSlot || ch === state.target[i],
          );
          if (matchesElsewhere) oracleWon = true;
        }
      }
      const lost = !won && !oracleWon && guesses.length >= state.maxGuesses;
      return {
        ...state,
        guesses,
        pendingGuess: null,
        status: won || oracleWon ? "won" : lost ? "lost" : "playing",
      };
    }
  }
}

export function remainingGuesses(state: GameState): number {
  return Math.max(0, state.maxGuesses - state.guesses.length);
}

function appendOfferedIds(
  prior: readonly ClueId[],
  options: readonly { id: ClueId }[],
): ClueId[] {
  const seen = new Set(prior);
  const out = prior.slice();
  for (const o of options) {
    if (!seen.has(o.id)) {
      seen.add(o.id);
      out.push(o.id);
    }
  }
  return out;
}
