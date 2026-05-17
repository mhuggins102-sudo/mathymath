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
import type { ClueId, ClueParam } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { containsDigitRoundComplete } from "@/lib/game/clues/containsDigit";
import { validateGuess } from "@/lib/game/validator";
import {
  buildGuessFromInput,
  deriveCertainDigits,
  inputCapacity,
} from "@/lib/game/certain";
import {
  canUseLockOnGuess,
  CLUE_REUSE_CLUE_ID,
  CLUE_REUSE_COST,
  initialLocksFor,
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
import { buildAchievementCtx } from "@/lib/achievements/buildCtx";
import { runAchievementCheck } from "@/lib/achievements/check";
import { pushAchievementToasts } from "@/lib/hooks/useAchievementToasts";

export interface UseGameConfig {
  target: string;
  seed: string;
  digits?: number;
  maxGuesses?: number;
  storageKey?: string;
  /** If true, records personal stats on terminal state. */
  trackStats?: boolean;
  /** "Advanced" rules: cap positional clues at 2 per game. Captured on
   *  game start; mid-game flips don't affect the in-progress reducer. */
  advancedMode?: boolean;
  /** "Preselected Clues" mode: the deck is dealt up-front; no chooser,
   *  no redraw. Captured on game start; mid-game flips don't apply. */
  preselectedClues?: boolean;
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
  /** True when the pending lock is on an already-committed lock —
   *  the Keypad label shows "Unlock" instead of "Lock". */
  unlockMode: boolean;
  /** When a clue with `paramKind` is chosen, this holds the clue id
   *  and the required parameter kind until the player makes their
   *  selection. null when no parameter is pending. For Contains
   *  Digit, `picks` accumulates the round's per-pick resolutions
   *  across the multi-pick UI. */
  pendingClueParam: {
    clueId: string;
    paramKind: "slot" | "reuse";
    reusedClueId?: string;
    picks?: {
      slot: number;
      digit: number;
      present: boolean;
      exact: boolean;
    }[];
  } | null;
  /** Whether the game is being played under advanced rules. */
  advancedMode: boolean;
  /** True when "Preselected Clues" mode is active for this game. */
  preselectedMode: boolean;
  /** The pre-dealt clue ids (one per non-final guess) or null when
   *  preselected mode is off. Stable across the game once set. */
  preselectedDeck: readonly ClueId[] | null;
  appendDigit: (d: string) => void;
  backspace: () => void;
  submit: () => void;
  /** Picks a clue. If the clue has `paramKind`, the hook enters
   *  parameter-selection mode instead of resolving immediately —
   *  call `confirmClueParam` once the player has selected. */
  chooseClue: (id: string) => void;
  /** Resolves a pending paramKind clue with the player's selection.
   *  For Oracle: `{ selectedSlot: N }`. No-op if no param is pending.
   *  Contains Digit uses `pickContainsDigit` instead — its multi-pick
   *  flow accumulates picks before resolving the round. */
  confirmClueParam: (param: ClueParam) => void;
  /** Cancels the pending clue param selection, returning to the
   *  chooser so the player can pick a different clue. */
  cancelClueParam: () => void;
  /** Contains Digit interactive: append one slot pick to the
   *  current Contains Digit round. Computes the new pick's
   *  exact/present/absent state locally (target is in state). On a
   *  red pick (digit absent from remaining target multiset) or once
   *  every slot has been picked, the round resolves and the row is
   *  appended to history; otherwise the picker stays open with the
   *  updated remaining slot list. */
  pickContainsDigit: (slot: number) => void;
  /** Burns one lock to discard the current clue pair and draw the
   *  next from the deck. Only available when pendingGuess is set
   *  and the player has at least one lock remaining. */
  redraw: () => void;
  canRedraw: boolean;
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
      advancedMode: config.advancedMode,
      preselectedClues: config.preselectedClues,
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
    if (!config.trackStats) return;
    if (statsRecordedRef.current) return;
    const updated = recordUnlimitedResult(
      state.status === "won",
      state.guesses.length,
      state.digits,
      state.advancedMode ? "hard" : "normal",
    );
    statsRecordedRef.current = true;
    setUnlimitedStats(updated);

    // Achievement check. Runs AFTER stats recording so `totalWins`
    // in the ctx reflects this game's outcome.
    const ctx = buildAchievementCtx({
      mode: "unlimited",
      digits: state.digits,
      status: state.status,
      target: state.target,
      guesses: state.guesses,
      advancedMode: state.advancedMode,
      preselectedMode: state.preselectedDeck !== null,
      maxGuesses: state.maxGuesses,
    });
    const unlocks = runAchievementCheck(ctx);
    if (unlocks.length > 0) pushAchievementToasts(unlocks);
  }, [
    state.status,
    state.guesses,
    state.digits,
    state.target,
    state.advancedMode,
    state.preselectedDeck,
    config.trackStats,
  ]);

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
  // True when the pending slot is an already-committed lock being
  // re-selected for unlock. Drives the Keypad's "Unlock" label.
  const [unlockMode, setUnlockMode] = useState(false);

  // Lock state is cleared INLINE in submit() — see the dispatches
  // there. This avoids an extra render cycle that used to run after
  // the reducer transitioned to pending (a useEffect watching
  // guessesLen/hasPending then fired a redundant setLockedSlots([])).
  // With many locks, that extra cycle was perceivable as a delay
  // between pressing Enter and the clue chooser appearing.

  // capacity for typed input = digits − certain − locks committed this turn.
  const capacity = inputCapacity(certain) - lockedSlots.length;

  // While a guess is pending (clue chooser is up), every lock placed on
  // this turn — correct OR incorrect — counts against the displayed
  // budget along with any redraws taken. Correct locks are refunded
  // when the round closes (the resolved guess lands in state.guesses
  // and the spec-level locksAvailable formula no longer treats them as
  // spent). The strict-during-chooser display keeps Clue Reuse and
  // redraw-again from looking affordable when the same-turn refund
  // hasn't actually happened yet. Mirrors useDailyGame.
  const baseLocksAvailable = computeLocksAvailable(
    state.guesses,
    initialLocksFor(state.advancedMode),
  );
  const pendingLocksUsedCount = state.pendingGuess?.locks?.length ?? 0;
  const pendingRedrawsCount = state.pendingGuess?.redraws ?? 0;
  const locksAvailableCount = state.pendingGuess
    ? Math.max(
        0,
        baseLocksAvailable - pendingLocksUsedCount - pendingRedrawsCount,
      )
    : baseLocksAvailable;
  const canUseLocks = canUseLockOnGuess();
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

  /** Helper: given a locally-computed locked array, find the input
   *  index where a digit at `slot` would be inserted. */
  const inputInsertIdx = useCallback(
    (slot: number, locked: readonly LockAttempt[]): number => {
      let idx = 0;
      for (let i = 0; i < slot; i++) {
        if (certain[i] !== null) continue;
        if (locked.some((l) => l.slot === i)) continue;
        idx++;
      }
      return idx;
    },
    [certain],
  );

  /** Helper: cancel the current pending lock selection. Returns the
   *  new { locked, input } after restoring the digit if needed. Does
   *  NOT call setState — the caller applies the returned values. */
  const cancelPendingLock = useCallback((): {
    locked: LockAttempt[];
    inp: string;
  } => {
    if (pendingLockSlot === null) return { locked: [...lockedSlots], inp: input };
    if (unlockMode) {
      // Was re-selecting a committed lock → keep the lock as-is.
      return { locked: [...lockedSlots], inp: input };
    }
    // Was creating a new lock → remove it. Restore the digit ONLY if
    // the input string is long enough that the digit would land back
    // at its original slot position. If the player backspaced in the
    // meantime, there are gaps and the digit would misplace — in that
    // case, drop it (cell goes blank, player can retype).
    const removed = lockedSlots.find((l) => l.slot === pendingLockSlot);
    const locked = lockedSlots.filter((l) => l.slot !== pendingLockSlot);
    let inp = input;
    if (removed) {
      const idx = inputInsertIdx(pendingLockSlot, locked);
      if (idx <= inp.length) {
        inp = inp.slice(0, idx) + removed.digit + inp.slice(idx);
      }
    }
    return { locked, inp };
  }, [pendingLockSlot, unlockMode, lockedSlots, input, inputInsertIdx]);

  const tapCell = useCallback(
    (slot: number) => {
      setError(null);
      if (slot < 0 || slot >= state.digits) return;
      if (certain[slot] !== null) return;

      // Same cell: cancel / toggle.
      if (pendingLockSlot === slot) {
        const { locked, inp } = cancelPendingLock();
        setLockedSlots(locked);
        setInput(inp);
        setPendingLockSlot(null);
        setUnlockMode(false);
        return;
      }

      // Different cell while pending → cancel old, start new.
      let effectiveLocked = [...lockedSlots];
      let effectiveInput = input;
      if (pendingLockSlot !== null) {
        const cancelled = cancelPendingLock();
        effectiveLocked = cancelled.locked;
        effectiveInput = cancelled.inp;
      }

      if (!canUseLocks) return;
      const isAlreadyLocked = effectiveLocked.some((l) => l.slot === slot);
      if (!isAlreadyLocked && effectiveLocked.length >= locksAvailableCount)
        return;

      if (isAlreadyLocked) {
        // Tapping a committed lock → unlock mode.
        setLockedSlots(effectiveLocked);
        setInput(effectiveInput);
        setPendingLockSlot(slot);
        setUnlockMode(true);
        return;
      }

      // Tapping a typed or empty cell → new lock with pre-fill.
      // Find typed digit at this slot in the effective state.
      let typedIdx: number | null = null;
      {
        let idx = 0;
        for (let i = 0; i < state.digits; i++) {
          if (certain[i] !== null) continue;
          if (effectiveLocked.some((l) => l.slot === i)) continue;
          if (i === slot) {
            typedIdx = idx < effectiveInput.length ? idx : null;
            break;
          }
          idx++;
        }
      }
      if (typedIdx !== null) {
        const digit = effectiveInput[typedIdx];
        effectiveInput =
          effectiveInput.slice(0, typedIdx) +
          effectiveInput.slice(typedIdx + 1);
        effectiveLocked = [
          ...effectiveLocked.filter((l) => l.slot !== slot),
          { slot, digit },
        ];
      }
      setLockedSlots(effectiveLocked);
      setInput(effectiveInput);
      setPendingLockSlot(slot);
      setUnlockMode(false);
    },
    [
      state.digits,
      certain,
      input,
      pendingLockSlot,
      lockedSlots,
      unlockMode,
      canUseLocks,
      locksAvailableCount,
      cancelPendingLock,
    ],
  );

  const commitLock = useCallback(() => {
    if (pendingLockSlot === null) return;
    if (unlockMode) {
      // Unlock: remove lock. Digit goes blank (not restored to input)
      // because the input string may have changed since the lock was
      // committed — re-inserting at the computed index could place the
      // digit in the wrong slot if earlier slots were backspaced.
      const newLocked = lockedSlots.filter((l) => l.slot !== pendingLockSlot);
      setLockedSlots(newLocked);
      setPendingLockSlot(null);
      setUnlockMode(false);
      return;
    }
    if (pendingLockDigit === null) return;
    setPendingLockSlot(null);
    setUnlockMode(false);
  }, [pendingLockSlot, pendingLockDigit, unlockMode, cancelPendingLock, lockedSlots, inputInsertIdx]);

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
  }, [pendingLockSlot, input, state.digits, certain, lockedSlots]);

  // --- Clue-parameter selection state ---
  //
  // Clues with `paramKind` (Oracle, Contains Digit) need an extra step
  // between the player tapping the clue in the chooser and the actual
  // CHOOSE_CLUE dispatch. The player picks the clue → hook enters
  // parameter-selection mode → UI shows a slot/digit picker → player
  // confirms → hook dispatches CHOOSE_CLUE with the param attached.
  const [pendingClueParam, setPendingClueParam] = useState<{
    clueId: string;
    paramKind: "slot" | "reuse";
    reusedClueId?: string;
    picks?: {
      slot: number;
      digit: number;
      present: boolean;
      exact: boolean;
    }[];
  } | null>(null);

  const chooseClue = useCallback(
    (id: string) => {
      if (!state.pendingGuess) return;
      const clue = state.pendingGuess.options.find((c) => c.id === id);
      if (!clue) return;
      // Defensive: refuse Clue Reuse when the lock budget can't cover
      // its cost. The chooser button is disabled in that state too,
      // but a stale render or a programmatic call would otherwise sneak
      // through.
      if (
        id === CLUE_REUSE_CLUE_ID &&
        locksAvailableCount < CLUE_REUSE_COST
      ) {
        return;
      }
      if (clue.paramKind) {
        // Park in parameter-selection mode; the UI will render a picker.
        setPendingClueParam({ clueId: id, paramKind: clue.paramKind });
        return;
      }
      dispatch({ type: "CHOOSE_CLUE", clueId: id as never });
    },
    [state.pendingGuess, locksAvailableCount],
  );

  const confirmClueParam = useCallback(
    (param: ClueParam) => {
      if (!pendingClueParam) return;
      // Chained flow for Clue Reuse → Contains Digit: when the reuse
      // picker yields a clue with paramKind=slot, enter that clue's
      // multi-pick picker before dispatching. Oracle no longer needs
      // a sub-picker (it auto-picks the farthest-off slot).
      if (pendingClueParam.paramKind === "reuse" && param.reusedClueId) {
        try {
          const reusedClue = getClueById(param.reusedClueId as never);
          if (reusedClue.paramKind === "slot") {
            setPendingClueParam({
              clueId: pendingClueParam.clueId,
              paramKind: "slot",
              reusedClueId: param.reusedClueId,
            });
            return;
          }
        } catch {
          // Unknown clue; fall through to dispatch.
        }
      }
      // Merge any stashed reusedClueId from the chained flow.
      const mergedParam = pendingClueParam.reusedClueId
        ? { ...param, reusedClueId: pendingClueParam.reusedClueId }
        : param;
      dispatch({
        type: "CHOOSE_CLUE",
        clueId: pendingClueParam.clueId as never,
        param: mergedParam,
      });
      setPendingClueParam(null);
    },
    [pendingClueParam],
  );

  const cancelClueParam = useCallback(() => {
    setPendingClueParam(null);
  }, []);

  const pickContainsDigit = useCallback(
    (slot: number) => {
      if (!pendingClueParam) return;
      if (pendingClueParam.paramKind !== "slot") return;
      const guess = state.pendingGuess?.guess;
      if (!guess) return;
      const priorSlots = (pendingClueParam.picks ?? []).map((p) => p.slot);
      const newSlots = [...priorSlots, slot];
      // Compute against the actual target — unlimited mode has it in
      // state.target. The containsDigit clue resolves the full pick
      // sequence (slot indices) into per-pick {present, exact} flags.
      const containsDigit = getClueById("containsDigit");
      const result = containsDigit.compute(guess, state.target, {
        picks: newSlots,
      });
      if (result.kind !== "containsDigit") return;
      const complete = containsDigitRoundComplete(guess, result.picks);
      if (complete) {
        const param = pendingClueParam.reusedClueId
          ? { picks: newSlots, reusedClueId: pendingClueParam.reusedClueId }
          : { picks: newSlots };
        dispatch({
          type: "CHOOSE_CLUE",
          clueId: pendingClueParam.clueId as never,
          param,
        });
        setPendingClueParam(null);
        return;
      }
      setPendingClueParam({ ...pendingClueParam, picks: result.picks });
    },
    [pendingClueParam, state.pendingGuess, state.target],
  );

  // Preselected mode: when SUBMIT_GUESS lands on a paramKind clue
  // (oracle / containsDigit), the reducer parks pendingGuess and the
  // chooser UI is suppressed. This effect routes the player straight
  // into the param picker so they don't see a stuck "pending" row.
  useEffect(() => {
    if (!state.preselectedDeck) return;
    if (!state.pendingGuess) return;
    if (pendingClueParam) return;
    const clue = state.pendingGuess.options[0];
    if (clue.paramKind) {
      setPendingClueParam({ clueId: clue.id, paramKind: clue.paramKind });
    }
  }, [state.preselectedDeck, state.pendingGuess, pendingClueParam]);

  // Redraw: burn a lock to discard the current pair and advance the
  // deck. locksAvailableCount above already subtracts this turn's
  // pending locks and prior redraws when a guess is pending, so a
  // positive budget is sufficient to afford one more redraw.
  const canRedraw =
    !!state.pendingGuess &&
    !pendingClueParam &&
    locksAvailableCount > 0 &&
    !state.preselectedDeck;

  const redraw = useCallback(() => {
    if (!canRedraw) return;
    dispatch({ type: "REDRAW" });
  }, [canRedraw]);

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
        advancedMode: config.advancedMode,
        preselectedClues: config.preselectedClues,
      });
      setInput("");
      setError(null);
    },
    [
      config.storageKey,
      config.digits,
      config.maxGuesses,
      config.advancedMode,
      config.preselectedClues,
    ],
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
    unlockMode,
    pendingClueParam,
    advancedMode: state.advancedMode,
    preselectedMode: state.preselectedDeck !== null,
    preselectedDeck: state.preselectedDeck,
    appendDigit,
    backspace,
    submit,
    chooseClue,
    confirmClueParam,
    cancelClueParam,
    pickContainsDigit,
    redraw,
    canRedraw,
    tapCell,
    commitLock,
    reset,
  };
}
