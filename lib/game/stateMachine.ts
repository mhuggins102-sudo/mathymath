import type { Clue, ClueId, ClueResult } from "./clues/types";
import { getClueById } from "./clues/registry";
import { pickTwoClues } from "./clueSelector";

export const DEFAULT_MAX_GUESSES = 8;

export type GameStatus = "playing" | "won" | "lost";

export interface ResolvedGuess {
  guess: string;
  clueId: ClueId;
  result: ClueResult;
}

export interface GameState {
  target: string;
  digits: number;
  maxGuesses: number;
  seed: string;
  guesses: ResolvedGuess[];
  /** Current pending guess waiting for the player to choose a clue. */
  pendingGuess: {
    guess: string;
    options: [Clue, Clue];
  } | null;
  status: GameStatus;
}

export type GameAction =
  | { type: "SUBMIT_GUESS"; guess: string }
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

      // Exact match = instant win; skip clue-choice modal.
      if (action.guess === state.target) {
        const clueId = "bullseyes";
        const result = getClueById(clueId).compute(action.guess, state.target);
        return {
          ...state,
          guesses: [
            ...state.guesses,
            { guess: action.guess, clueId, result },
          ],
          status: "won",
        };
      }

      const options = pickTwoClues(state.seed, state.guesses.length);
      return {
        ...state,
        pendingGuess: { guess: action.guess, options },
      };
    }

    case "CHOOSE_CLUE": {
      if (!state.pendingGuess) return state;
      const { guess, options } = state.pendingGuess;
      const clue = options.find((c) => c.id === action.clueId);
      if (!clue) return state;
      const result = clue.compute(guess, state.target);
      const guesses = [...state.guesses, { guess, clueId: clue.id, result }];
      const won = guess === state.target; // defensive; SUBMIT_GUESS short-circuits already
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
