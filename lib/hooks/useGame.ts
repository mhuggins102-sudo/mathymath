"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  DEFAULT_MAX_GUESSES,
  type GameAction,
  type GameState,
  type LockAttempt,
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
  canUseLockOnGuess,
  locksAvailable as computeLocksAvailable,
} from "@/lib/game/locks";
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
   *  slots minus the number of committed locks this turn. */
  inputCapacity: number;
  /** Locks the player has committed for the current turn (before submit). */
  lockedSlots: readonly LockAttempt[];
  /** Slot currently selected for lock entry, or null if not in lock mode. */
  pendingLockSlot: number | null;
  /** Locks the player has REMAINING this game (cap minus spent). */
  locksAvailable: number;
  /** True iff the player is allowed to start a new lock on this turn:
   *  past guess 1, at least one lock remaining, below-max this turn. */
  canStartLock: boolean;
  /** True iff the pending lock has a digit and can be committed. */
  canCommitPendingLock: boolean;
  appendDigit: (d: string) => void;
  backspace: () => void;
  submit: () => void;
  chooseClue: (id: string) => void;
  /** Player tapped cell `slot`. Enters lock-selection on an empty or
   *  typed non-certain cell; cancels lock-selection (and drops any
   *  pending digit) when the same cell is tapped again. Tapping a
   *  different cell while one is already pending is a no-op (see Q8). */
  tapCell: (slot: number) => void;
  /** Commit the currently-pending lock (fires when the "Lock"
   *  transformed-Enter button is pressed). No-op otherwise. */
  commitLock: () => void;
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

  // ----- Input + lock state ------------------------------------------------
  //
  // Model:
  //   - `input` is the string of digits typed this turn, each char
  //     projected LTR onto non-certain, non-locked slots.
  //   - `lockedSlots` records slots the player has locked this turn
  //     (digit committed; correctness TBD on submit).
  //   - `pendingLockSlot` is the slot currently in lock-selection mode,
  //     or null for normal typing. While non-null, Enter becomes Lock:
  //     number keys write the pending digit, backspace clears it, and
  //     tapping the same cell cancels.
  const certain = deriveCertainDigits(state.guesses, state.digits);
  const [lockedSlots, setLockedSlots] = useState<LockAttempt[]>([]);
  const [pendingLockSlot, setPendingLockSlot] = useState<number | null>(null);

  // Lock state is cleared INLINE in submit() — see the dispatches
  // there. This avoids an extra render cycle that used to run after
  // the reducer transitioned to pending (a useEffect watching
  // guessesLen/hasPending then fired a redundant setLockedSlots([])).
  // With many locks, that extra cycle was perceivable as a delay
  // between pressing Enter and the clue chooser appearing.

  // capacity for typed input = digits − certain − locks committed this turn.
  const capacity = inputCapacity(certain) - lockedSlots.length;

  const locksAvailableCount = computeLocksAvailable(state.guesses);
  const canUseLocks = canUseLockOnGuess(state.guesses.length);
  const canStartLock =
    canUseLocks && lockedSlots.length < locksAvailableCount;
  const pendingLockDigit = useMemo(() => {
    if (pendingLockSlot === null) return null;
    return (
      lockedSlots.find((l) => l.slot === pendingLockSlot)?.digit ?? null
    );
  }, [pendingLockSlot, lockedSlots]);
  const canCommitPendingLock =
    pendingLockSlot !== null && pendingLockDigit !== null;

  /** Given a slot, return the index in `input` that projects to it —
   *  null if the slot is certain, locked, or past the current input
   *  length. Used when the player taps a typed cell to re-purpose it
   *  as a lock: we need to remove that character from `input`. */
  const typedIndexForSlot = useCallback(
    (slot: number): number | null => {
      let idx = 0;
      for (let i = 0; i < state.digits; i++) {
        if (certain[i] !== null) continue;
        if (lockedSlots.some((l) => l.slot === i)) continue;
        if (i === slot) return idx < input.length ? idx : null;
        idx++;
      }
      return null;
    },
    [state.digits, certain, lockedSlots, input],
  );

  const appendDigit = useCallback(
    (d: string) => {
      setError(null);
      if (pendingLockSlot !== null) {
        // Lock-entry mode: set or overwrite the pending slot's digit.
        setLockedSlots((cur) => {
          const others = cur.filter((l) => l.slot !== pendingLockSlot);
          return [...others, { slot: pendingLockSlot, digit: d }];
        });
        return;
      }
      // Normal typing: fill the next available slot.
      setInput((cur) => (cur.length >= capacity ? cur : cur + d));
    },
    [pendingLockSlot, capacity],
  );

  const backspace = useCallback(() => {
    setError(null);
    if (pendingLockSlot !== null) {
      // In lock-entry mode, backspace clears the pending slot's digit
      // but keeps the slot selected for re-entry.
      setLockedSlots((cur) => cur.filter((l) => l.slot !== pendingLockSlot));
      return;
    }
    setInput((cur) => cur.slice(0, -1));
  }, [pendingLockSlot]);

  const tapCell = useCallback(
    (slot: number) => {
      setError(null);
      if (slot < 0 || slot >= state.digits) return;
      if (certain[slot] !== null) return; // immutable
      // Cancel: same cell tapped again → drop pending and any digit.
      if (pendingLockSlot === slot) {
        setLockedSlots((cur) => cur.filter((l) => l.slot !== slot));
        setPendingLockSlot(null);
        return;
      }
      // Different cell while one is already pending → ignore (Q8: no
      // switching while a lock is in progress).
      if (pendingLockSlot !== null) return;
      // Cannot start a new lock without budget or on guess 1.
      const isAlreadyLocked = lockedSlots.some((l) => l.slot === slot);
      if (!canUseLocks) return;
      if (!isAlreadyLocked && lockedSlots.length >= locksAvailableCount)
        return;
      // If the slot currently shows a typed char, remove that index
      // from input so it stops projecting to this slot.
      const idx = typedIndexForSlot(slot);
      if (idx !== null) {
        setInput((cur) => cur.slice(0, idx) + cur.slice(idx + 1));
      }
      setPendingLockSlot(slot);
    },
    [
      state.digits,
      certain,
      pendingLockSlot,
      lockedSlots,
      canUseLocks,
      locksAvailableCount,
      typedIndexForSlot,
    ],
  );

  const commitLock = useCallback(() => {
    if (pendingLockSlot === null) return;
    if (pendingLockDigit === null) return;
    // The lock stays in lockedSlots; we just exit lock-entry mode so
    // number keys resume typing and the Enter label reverts.
    setPendingLockSlot(null);
    buzz(18);
  }, [pendingLockSlot, pendingLockDigit]);

  const submit = useCallback(() => {
    // Refuse to submit from inside lock-entry mode (user should commit
    // or cancel the pending lock first). Avoids confusing half-states.
    if (pendingLockSlot !== null) return;
    // Build the full guess by interleaving typed input with certain
    // digits AND locked slots.
    const overlay: (string | null)[] = certain.slice();
    for (const l of lockedSlots) overlay[l.slot] = l.digit;
    const fullGuess = buildGuessFromInput(overlay, input);
    const v = validateGuess(fullGuess, state.digits);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError(null);
    dispatch({
      type: "SUBMIT_GUESS",
      guess: v.digits,
      locks: lockedSlots.length > 0 ? lockedSlots : undefined,
    });
    setInput("");
    // Clear the turn's lock state in the SAME sync context as the
    // dispatch so React batches both into one render — the clue
    // chooser shows on the first post-submit paint with no perceptible
    // lag, even when two locks are in play.
    setLockedSlots([]);
    setPendingLockSlot(null);
    buzz(12);
  }, [pendingLockSlot, input, state.digits, certain, lockedSlots]);

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
    lockedSlots,
    pendingLockSlot,
    locksAvailable: locksAvailableCount,
    canStartLock,
    canCommitPendingLock,
    appendDigit,
    backspace,
    submit,
    chooseClue,
    tapCell,
    commitLock,
    reset,
  };
}
