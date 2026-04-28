import type { Clue, ClueId, ClueResult } from "./clues/types";
import { getClueById } from "./clues/registry";
import {
  advancedPositionalCapReached,
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
  /** "Advanced" rules toggle, captured at game start. Setting changes
   *  during a game don't affect the in-progress reducer — only the next
   *  RESET picks up the new flag. Daily mode never enables this. */
  advancedMode: boolean;
  /** Current pending guess waiting for the player to choose a clue.
   *  `locks` travels with the pending guess so the chosen clue handler
   *  can append them to the resolved history alongside the clue result. */
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
  | { type: "CHOOSE_CLUE"; clueId: ClueId; param?: { selectedSlot?: number; selectedDigit?: number } }
  | { type: "REDRAW" }
  | {
      type: "RESET";
      target: string;
      seed: string;
      digits?: number;
      maxGuesses?: number;
      advancedMode?: boolean;
    };

export function initGameState(params: {
  target: string;
  seed: string;
  digits?: number;
  maxGuesses?: number;
  advancedMode?: boolean;
}): GameState {
  return {
    target: params.target,
    seed: params.seed,
    digits: params.digits ?? params.target.length,
    maxGuesses: params.maxGuesses ?? DEFAULT_MAX_GUESSES,
    guesses: [],
    deckOffset: 0,
    advancedMode: params.advancedMode ?? false,
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

      const usedClueIds = state.guesses
        .map((g) => g.clueId)
        .filter((id): id is ClueId => id !== undefined);
      const excludePositional = advancedPositionalCapReached(
        state.advancedMode,
        state.guesses,
      );
      const options = pickTwoClues(
        state.seed,
        usedClueIds,
        state.deckOffset,
        excludePositional,
        state.advancedMode,
      );
      return {
        ...state,
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
      // Lock budget check is the caller's responsibility (the hook
      // gates the redraw button). The reducer just advances the deck.
      const newOffset = state.deckOffset + 1;
      const usedClueIds = state.guesses
        .map((g) => g.clueId)
        .filter((id): id is ClueId => id !== undefined);
      const excludePositional = advancedPositionalCapReached(
        state.advancedMode,
        state.guesses,
      );
      const newOptions = pickTwoClues(
        state.seed,
        usedClueIds,
        newOffset,
        excludePositional,
        state.advancedMode,
      );
      return {
        ...state,
        deckOffset: newOffset,
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
      const result = clue.compute(guess, state.target, {
        knownSlots,
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
