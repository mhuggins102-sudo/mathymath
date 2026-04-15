import type { Clue, ClueId, ClueResult } from "./clues/types";
import { getClueById } from "./clues/registry";
import { pickTwoClues } from "./clueSelector";
import type { LockRecord } from "./locks";

export const DEFAULT_MAX_GUESSES = 8;

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
  /** Current pending guess waiting for the player to choose a clue.
   *  `locks` travels with the pending guess so the chosen clue handler
   *  can append them to the resolved history alongside the clue result. */
  pendingGuess: {
    guess: string;
    options: [Clue, Clue];
    locks?: LockRecord[];
  } | null;
  status: GameStatus;
}

export type GameAction =
  | { type: "SUBMIT_GUESS"; guess: string; locks?: readonly LockAttempt[] }
  | { type: "CHOOSE_CLUE"; clueId: ClueId }
  | { type: "RESET"; target: string; seed: string; digits?: number; maxGuesses?: number };

export function initGameState(params: {
  target: string;
  seed: string;
  digits?: number;
  maxGuesses?: number;
}): GameState {
  return {
    target: params.target,
    seed: params.seed,
    digits: params.digits ?? params.target.length,
    maxGuesses: params.maxGuesses ?? DEFAULT_MAX_GUESSES,
    guesses: [],
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
      const options = pickTwoClues(state.seed, usedClueIds);
      return {
        ...state,
        pendingGuess: {
          guess: action.guess,
          options,
          ...(resolvedLocks.length > 0 ? { locks: resolvedLocks } : {}),
        },
      };
    }

    case "CHOOSE_CLUE": {
      if (!state.pendingGuess) return state;
      const { guess, options, locks } = state.pendingGuess;
      const clue = options.find((c) => c.id === action.clueId);
      if (!clue) return state;
      const result = clue.compute(guess, state.target);
      const guesses = [
        ...state.guesses,
        {
          guess,
          clueId: clue.id,
          result,
          ...(locks && locks.length > 0 ? { locks } : {}),
        },
      ];
      const won = guess === state.target;
      const lost = !won && guesses.length >= state.maxGuesses;
      return {
        ...state,
        guesses,
        pendingGuess: null,
        status: won ? "won" : lost ? "lost" : "playing",
      };
    }
  }
}

export function remainingGuesses(state: GameState): number {
  return Math.max(0, state.maxGuesses - state.guesses.length);
}
