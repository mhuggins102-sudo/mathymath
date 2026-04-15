"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  DEFAULT_MAX_GUESSES,
  type GameAction,
  type GameState,
  initGameState,
  reduce,
} from "@/lib/game/stateMachine";
import { validateGuess } from "@/lib/game/validator";
import {
  buildGuessFromInput,
  deriveCertainDigits,
  inputCapacity,
} from "@/lib/game/certain";
import {
  clearGame,
  loadGame,
  loadUnlimitedStats,
  recordUnlimitedResult,
  saveGame,
  type PersonalStats,
} from "@/lib/persistence/localStore";
import { buzz } from "@/lib/settings";

export interface UseGameConfig {
  target: string;
  seed: string;
  digits?: number;
  maxGuesses?: number;
  storageKey?: string;
  /** If true, records personal stats on terminal state. */
  trackStats?: boolean;
}

export interface UseGameResult {
  state: GameState;
  input: string;
  error: string | null;
  hydrated: boolean;
  /** Non-null only when trackStats is enabled and stats have been loaded. */
  unlimitedStats: PersonalStats | null;
  /** Digits that are known-certain from prior clues (length = state.digits,
   *  entries are the known char "0".."9" or null). */
  certainDigits: (string | null)[];
  /** Max typed-input length: state.digits minus the number of certain
   *  slots. The consumer uses this for submit-disabled gating. */
  inputCapacity: number;
  appendDigit: (d: string) => void;
  backspace: () => void;
  submit: () => void;
  chooseClue: (id: string) => void;
  reset: (params: { target: string; seed: string }) => void;
}

export function useGame(config: UseGameConfig): UseGameResult {
  const reducer = reduce as (state: GameState, action: GameAction) => GameState;
  const [state, dispatch] = useReducer(
    reducer,
    initGameState({
      target: config.target,
      seed: config.seed,
      digits: config.digits,
      maxGuesses: config.maxGuesses ?? DEFAULT_MAX_GUESSES,
    }),
  );

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [unlimitedStats, setUnlimitedStats] = useState<PersonalStats | null>(null);
  const statsRecordedRef = useRef(false);

  // Load initial personal stats once on mount (so they render under the
  // game area even before the first win).
  useEffect(() => {
    if (!config.trackStats) return;
    setUnlimitedStats(loadUnlimitedStats());
  }, [config.trackStats]);

  // Hydration: load saved game if present.
  useEffect(() => {
    if (!config.storageKey) {
      setHydrated(true);
      return;
    }
    const saved = loadGame(config.storageKey);
    if (saved && saved.target === config.target && saved.seed === config.seed) {
      // Replay saved guesses into a fresh reducer.
      // Guesses without a clueId are final-guess losses — SUBMIT_GUESS
      // short-circuits them into the lost state, no CHOOSE_CLUE needed.
      for (const g of saved.guesses) {
        dispatch({ type: "SUBMIT_GUESS", guess: g.guess });
        if (g.clueId) {
          dispatch({ type: "CHOOSE_CLUE", clueId: g.clueId as never });
        }
      }
    }
    setHydrated(true);
  }, [config.storageKey, config.target, config.seed]);

  // Persist in-progress game (only when we have a storage key, i.e. daily mode).
  useEffect(() => {
    if (!config.storageKey || !hydrated) return;
    saveGame(config.storageKey, state);
  }, [state, config.storageKey, hydrated]);

  // Record personal stats on terminal state.
  // Runs independently of storageKey so unlimited mode (which has no
  // storageKey) still gets stats recorded.
  useEffect(() => {
    if (state.status === "playing") return;
    if (state.status === "won") buzz(40);
    if (!config.trackStats) return;
    if (statsRecordedRef.current) return;
    const updated = recordUnlimitedResult(
      state.status === "won",
      state.guesses.length,
    );
    statsRecordedRef.current = true;
    setUnlimitedStats(updated);
  }, [state.status, state.guesses.length, config.trackStats]);

  // `input` stores only the digits the player has TYPED into non-certain
  // slots — certain slots (revealed by prior clues) are auto-filled on
  // submit. `capacity` is how many typed digits the input can hold.
  const certain = deriveCertainDigits(state.guesses, state.digits);
  const capacity = inputCapacity(certain);

  const appendDigit = useCallback(
    (d: string) => {
      setError(null);
      setInput((cur) => (cur.length >= capacity ? cur : cur + d));
    },
    [capacity],
  );

  const backspace = useCallback(() => {
    setError(null);
    setInput((cur) => cur.slice(0, -1));
  }, []);

  const submit = useCallback(() => {
    // Build the full guess by interleaving the player's typed input with
    // the known certain digits, then validate as usual.
    const fullGuess = buildGuessFromInput(certain, input);
    const v = validateGuess(fullGuess, state.digits);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError(null);
    dispatch({ type: "SUBMIT_GUESS", guess: v.digits });
    setInput("");
    buzz(12);
  }, [input, state.digits, certain]);

  const chooseClue = useCallback((id: string) => {
    dispatch({ type: "CHOOSE_CLUE", clueId: id as never });
    buzz(18);
  }, []);

  const reset = useCallback(
    (params: { target: string; seed: string }) => {
      if (config.storageKey) clearGame(config.storageKey);
      statsRecordedRef.current = false;
      dispatch({
        type: "RESET",
        target: params.target,
        seed: params.seed,
        digits: config.digits,
        maxGuesses: config.maxGuesses,
      });
      setInput("");
      setError(null);
    },
    [config.storageKey, config.digits, config.maxGuesses],
  );

  return {
    state,
    input,
    error,
    hydrated,
    unlimitedStats,
    certainDigits: certain,
    inputCapacity: capacity,
    appendDigit,
    backspace,
    submit,
    chooseClue,
    reset,
  };
}
