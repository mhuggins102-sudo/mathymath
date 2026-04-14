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
  clearGame,
  loadGame,
  loadUnlimitedStats,
  recordUnlimitedResult,
  saveGame,
  type PersonalStats,
} from "@/lib/persistence/localStore";

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
      // (We keep the reducer simple by re-applying SUBMIT_GUESS + CHOOSE_CLUE.)
      for (const g of saved.guesses) {
        dispatch({ type: "SUBMIT_GUESS", guess: g.guess });
        dispatch({ type: "CHOOSE_CLUE", clueId: g.clueId as never });
      }
    }
    setHydrated(true);
  }, [config.storageKey, config.target, config.seed]);

  // Persist.
  useEffect(() => {
    if (!config.storageKey || !hydrated) return;
    saveGame(config.storageKey, state);
    if (state.status !== "playing") {
      if (config.trackStats && !statsRecordedRef.current) {
        const updated = recordUnlimitedResult(
          state.status === "won",
          state.guesses.length,
        );
        statsRecordedRef.current = true;
        setUnlimitedStats(updated);
      }
    }
  }, [state, config.storageKey, config.trackStats, hydrated]);

  const appendDigit = useCallback(
    (d: string) => {
      setError(null);
      setInput((cur) => (cur.length >= state.digits ? cur : cur + d));
    },
    [state.digits],
  );

  const backspace = useCallback(() => {
    setError(null);
    setInput((cur) => cur.slice(0, -1));
  }, []);

  const submit = useCallback(() => {
    const v = validateGuess(input, state.digits);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError(null);
    dispatch({ type: "SUBMIT_GUESS", guess: v.digits });
    setInput("");
  }, [input, state.digits]);

  const chooseClue = useCallback((id: string) => {
    dispatch({ type: "CHOOSE_CLUE", clueId: id as never });
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
    appendDigit,
    backspace,
    submit,
    chooseClue,
    reset,
  };
}
