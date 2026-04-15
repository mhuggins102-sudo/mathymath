"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Clue, ClueId, ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { validateGuess } from "@/lib/game/validator";
import {
  loadDailyGame,
  saveDailyGame,
  type SavedDailyGame,
} from "@/lib/persistence/localStore";
import { buzz } from "@/lib/settings";

/**
 * Client-side shape for a daily game. This deliberately mirrors the
 * pieces of the state-machine `GameState` that the UI cares about, but
 * without `target` — the server owns that and only reveals it on the
 * terminal reveal. `revealedTarget` is populated only after win/loss.
 */
export interface DailyGameState {
  date: string;
  digits: number;
  maxGuesses: number;
  guesses: Array<{
    guess: string;
    clueId?: ClueId;
    result?: ClueResult;
  }>;
  pendingGuess: { guess: string; options: [Clue, Clue] } | null;
  status: "playing" | "won" | "lost";
  revealedTarget: string | null;
}

export interface UseDailyGameConfig {
  date: string;
  digits: number;
  maxGuesses: number;
  storageKey: string;
}

export interface UseDailyGameResult {
  state: DailyGameState;
  input: string;
  error: string | null;
  /** True after the first localStorage load attempt. Consumers should
   *  delay side effects (analytics, autofocus) until this is true. */
  hydrated: boolean;
  /** True while a server round-trip is in flight. UI disables input. */
  loading: boolean;
  appendDigit: (d: string) => void;
  backspace: () => void;
  submit: () => void;
  chooseClue: (id: ClueId) => void;
}

function initialState(config: UseDailyGameConfig): DailyGameState {
  return {
    date: config.date,
    digits: config.digits,
    maxGuesses: config.maxGuesses,
    guesses: [],
    pendingGuess: null,
    status: "playing",
    revealedTarget: null,
  };
}

function toSaved(state: DailyGameState): SavedDailyGame {
  return {
    version: 1,
    date: state.date,
    digits: state.digits,
    maxGuesses: state.maxGuesses,
    guesses: state.guesses.map((g) => ({
      guess: g.guess,
      clueId: g.clueId,
      result: g.result,
    })),
    pendingGuess: state.pendingGuess
      ? {
          guess: state.pendingGuess.guess,
          optionIds: [
            state.pendingGuess.options[0].id,
            state.pendingGuess.options[1].id,
          ],
        }
      : null,
    status: state.status,
    revealedTarget: state.revealedTarget,
  };
}

function fromSaved(
  saved: SavedDailyGame,
  config: UseDailyGameConfig,
): DailyGameState {
  // Defensive: saved.date must match; otherwise re-init.
  if (saved.date !== config.date) return initialState(config);
  let pendingGuess: DailyGameState["pendingGuess"] = null;
  if (saved.pendingGuess) {
    try {
      const a = getClueById(saved.pendingGuess.optionIds[0] as ClueId);
      const b = getClueById(saved.pendingGuess.optionIds[1] as ClueId);
      pendingGuess = { guess: saved.pendingGuess.guess, options: [a, b] };
    } catch {
      // Unknown clue id (e.g. a retired clue in older saves). Drop
      // pending and let the player resubmit.
      pendingGuess = null;
    }
  }
  return {
    date: saved.date,
    digits: saved.digits,
    maxGuesses: saved.maxGuesses,
    guesses: saved.guesses.map((g) => ({
      guess: g.guess,
      clueId: g.clueId as ClueId | undefined,
      result: g.result as ClueResult | undefined,
    })),
    pendingGuess,
    status: saved.status,
    revealedTarget: saved.revealedTarget,
  };
}

/** Strip Clue objects out of the history when sending to the server.
 *  Only { guess, clueId?, result? } travels over the wire. */
function historyForServer(state: DailyGameState) {
  return state.guesses.map((g) => ({
    guess: g.guess,
    clueId: g.clueId,
    result: g.result,
  }));
}

export function useDailyGame(config: UseDailyGameConfig): UseDailyGameResult {
  const [state, setState] = useState<DailyGameState>(() => initialState(config));
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  // Prevents double-submits from racing with a pending network call.
  const inFlightRef = useRef(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const saved = loadDailyGame(config.storageKey);
    if (saved) setState(fromSaved(saved, config));
    setHydrated(true);
    // config is stable for the lifetime of a given daily page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.storageKey, config.date]);

  // Persist on every state change, once hydration is complete.
  useEffect(() => {
    if (!hydrated) return;
    saveDailyGame(config.storageKey, toSaved(state));
  }, [state, config.storageKey, hydrated]);

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

  const submit = useCallback(async () => {
    if (inFlightRef.current) return;
    if (state.status !== "playing" || state.pendingGuess) return;
    const v = validateGuess(input, state.digits);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    buzz(12);
    try {
      const res = await fetch(
        `/api/daily/${encodeURIComponent(state.date)}/submit-guess`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            history: historyForServer(state),
            guess: v.digits,
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "server_error");
        return;
      }
      if (body.kind === "won") {
        setState((s) => ({
          ...s,
          guesses: [
            ...s.guesses,
            { guess: v.digits, clueId: "bullseyes", result: body.result },
          ],
          pendingGuess: null,
          status: "won",
          revealedTarget: body.target,
        }));
        setInput("");
      } else if (body.kind === "lost") {
        setState((s) => ({
          ...s,
          guesses: [...s.guesses, { guess: v.digits }],
          pendingGuess: null,
          status: "lost",
          revealedTarget: body.target,
        }));
        setInput("");
      } else if (body.kind === "pending") {
        const optIds = body.options as [ClueId, ClueId];
        const opts: [Clue, Clue] = [
          getClueById(optIds[0]),
          getClueById(optIds[1]),
        ];
        setState((s) => ({
          ...s,
          pendingGuess: { guess: v.digits, options: opts },
        }));
        setInput("");
      } else {
        setError("unexpected_response");
      }
    } catch {
      setError("network_error");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [input, state]);

  const chooseClue = useCallback(
    async (clueId: ClueId) => {
      if (inFlightRef.current) return;
      if (!state.pendingGuess || state.status !== "playing") return;
      const pending = state.pendingGuess;
      // Sanity: the picked id must actually be in the offered pair.
      if (!pending.options.some((c) => c.id === clueId)) {
        setError("invalid_clue");
        return;
      }
      inFlightRef.current = true;
      setError(null);
      setLoading(true);
      buzz(18);
      try {
        const res = await fetch(
          `/api/daily/${encodeURIComponent(state.date)}/choose-clue`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              history: historyForServer(state),
              pendingGuess: pending.guess,
              clueId,
            }),
          },
        );
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "server_error");
          return;
        }
        if (body.kind === "continue") {
          setState((s) => ({
            ...s,
            guesses: [
              ...s.guesses,
              { guess: pending.guess, clueId, result: body.result },
            ],
            pendingGuess: null,
          }));
        } else {
          setError("unexpected_response");
        }
      } catch {
        setError("network_error");
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [state],
  );

  return {
    state,
    input,
    error,
    hydrated,
    loading,
    appendDigit,
    backspace,
    submit,
    chooseClue,
  };
}
