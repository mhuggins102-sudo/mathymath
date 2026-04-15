"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Clue, ClueId, ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { validateGuess } from "@/lib/game/validator";
import {
  loadDailyGame,
  saveDailyGame,
  type SavedDailyGame,
} from "@/lib/persistence/localStore";
import { buzz } from "@/lib/settings";
import {
  buildGuessFromInput,
  deriveCertainDigits,
  inputCapacity,
} from "@/lib/game/certain";
import {
  canUseLockOnGuess,
  locksAvailable as computeLocksAvailable,
  type LockRecord,
} from "@/lib/game/locks";

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
    locks?: LockRecord[];
  }>;
  pendingGuess: {
    guess: string;
    options: [Clue, Clue];
    locks?: LockRecord[];
  } | null;
  status: "playing" | "won" | "lost";
  revealedTarget: string | null;
}

export interface LockAttempt {
  slot: number;
  digit: string;
}

export interface UseDailyGameConfig {
  date: string;
  digits: number;
  maxGuesses: number;
  storageKey: string;
  /** Called synchronously inside the localStorage-hydration effect when
   *  the saved game turned out to be already terminal (won or lost).
   *  The consumer uses this to, e.g., open the result popup in the
   *  same batched update as the state transition — so the resolved
   *  grid doesn't flash underneath before the Modal covers it. */
  onHydratedTerminal?: (status: "won" | "lost") => void;
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
  /** Per-slot digits known-certain from prior clues (length = digits). */
  certainDigits: (string | null)[];
  /** Max typed-input length = digits − certain − committed locks this turn. */
  inputCapacity: number;
  lockedSlots: readonly LockAttempt[];
  pendingLockSlot: number | null;
  locksAvailable: number;
  canStartLock: boolean;
  canCommitPendingLock: boolean;
  appendDigit: (d: string) => void;
  backspace: () => void;
  submit: () => void;
  chooseClue: (id: ClueId) => void;
  tapCell: (slot: number) => void;
  commitLock: () => void;
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
      locks: g.locks,
    })),
    pendingGuess: state.pendingGuess
      ? {
          guess: state.pendingGuess.guess,
          optionIds: [
            state.pendingGuess.options[0].id,
            state.pendingGuess.options[1].id,
          ],
          locks: state.pendingGuess.locks,
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
  // Also re-init if the saved maxGuesses no longer matches config —
  // happens after a budget change (e.g. the 8 → 7 drop). Continuing
  // with the old budget would either extend the game past the server's
  // limit or truncate mid-history; clean re-init is safer.
  if (saved.maxGuesses !== config.maxGuesses) return initialState(config);
  let pendingGuess: DailyGameState["pendingGuess"] = null;
  if (saved.pendingGuess) {
    try {
      const a = getClueById(saved.pendingGuess.optionIds[0] as ClueId);
      const b = getClueById(saved.pendingGuess.optionIds[1] as ClueId);
      pendingGuess = {
        guess: saved.pendingGuess.guess,
        options: [a, b],
        locks: saved.pendingGuess.locks,
      };
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
      locks: g.locks,
    })),
    pendingGuess,
    status: saved.status,
    revealedTarget: saved.revealedTarget,
  };
}

/** Strip Clue objects out of the history when sending to the server.
 *  { guess, clueId?, result?, locks? } travels over the wire — the
 *  server replays the history including locks for integrity. */
function historyForServer(state: DailyGameState) {
  return state.guesses.map((g) => ({
    guess: g.guess,
    clueId: g.clueId,
    result: g.result,
    locks: g.locks,
  }));
}

export function useDailyGame(config: UseDailyGameConfig): UseDailyGameResult {
  const [state, setState] = useState<DailyGameState>(() => initialState(config));
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockedSlots, setLockedSlots] = useState<LockAttempt[]>([]);
  const [pendingLockSlot, setPendingLockSlot] = useState<number | null>(null);
  // Prevents double-submits from racing with a pending network call.
  const inFlightRef = useRef(false);

  // Hydrate from localStorage on mount. When the saved state is
  // already terminal, fire onHydratedTerminal from inside this same
  // effect so the consumer's popup-open setState batches with our
  // setState(fromSaved) — one render transition, no flash of the
  // resolved grid before the Modal covers it.
  const onHydratedTerminal = config.onHydratedTerminal;
  useEffect(() => {
    const saved = loadDailyGame(config.storageKey);
    if (saved) {
      setState(fromSaved(saved, config));
      if (saved.status !== "playing") {
        onHydratedTerminal?.(saved.status);
      }
    }
    setHydrated(true);
    // config is stable for the lifetime of a given daily page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.storageKey, config.date]);

  // Persist on every state change, once hydration is complete.
  useEffect(() => {
    if (!hydrated) return;
    saveDailyGame(config.storageKey, toSaved(state));
  }, [state, config.storageKey, hydrated]);

  // Lock state is cleared INLINE in submit() below — batched with the
  // setState(pendingGuess) so the clue chooser shows on the first
  // post-submit render. An earlier effect-based clear was visible as a
  // slight delay between Enter press and clue options appearing, more
  // pronounced with two locks.

  // `input` holds only typed-into-non-certain-non-locked-slots.
  const certain = deriveCertainDigits(state.guesses, state.digits);
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
        setLockedSlots((cur) => {
          const others = cur.filter((l) => l.slot !== pendingLockSlot);
          return [...others, { slot: pendingLockSlot, digit: d }];
        });
        return;
      }
      setInput((cur) => (cur.length >= capacity ? cur : cur + d));
    },
    [pendingLockSlot, capacity],
  );

  const backspace = useCallback(() => {
    setError(null);
    if (pendingLockSlot !== null) {
      setLockedSlots((cur) => cur.filter((l) => l.slot !== pendingLockSlot));
      return;
    }
    setInput((cur) => cur.slice(0, -1));
  }, [pendingLockSlot]);

  const tapCell = useCallback(
    (slot: number) => {
      setError(null);
      if (slot < 0 || slot >= state.digits) return;
      if (certain[slot] !== null) return;
      if (pendingLockSlot === slot) {
        setLockedSlots((cur) => cur.filter((l) => l.slot !== slot));
        setPendingLockSlot(null);
        return;
      }
      if (pendingLockSlot !== null) return; // Q8: no switching.
      const isAlreadyLocked = lockedSlots.some((l) => l.slot === slot);
      if (!canUseLocks) return;
      if (!isAlreadyLocked && lockedSlots.length >= locksAvailableCount)
        return;
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
    setPendingLockSlot(null);
    buzz(18);
  }, [pendingLockSlot, pendingLockDigit]);

  const submit = useCallback(async () => {
    if (inFlightRef.current) return;
    if (state.status !== "playing" || state.pendingGuess) return;
    // Refuse submit while a lock is still pending — same rule as
    // unlimited: commit or cancel first.
    if (pendingLockSlot !== null) return;
    const overlay: (string | null)[] = certain.slice();
    for (const l of lockedSlots) overlay[l.slot] = l.digit;
    const fullGuess = buildGuessFromInput(overlay, input);
    const v = validateGuess(fullGuess, state.digits);
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
            lockAttempts:
              lockedSlots.length > 0 ? lockedSlots : undefined,
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "server_error");
        return;
      }
      const resolvedLocks = (body.locks as LockRecord[] | undefined) ?? [];
      const locksField =
        resolvedLocks.length > 0 ? { locks: resolvedLocks } : {};
      if (body.kind === "won") {
        setState((s) => ({
          ...s,
          guesses: [
            ...s.guesses,
            {
              guess: v.digits,
              clueId: "bullseyes",
              result: body.result,
              ...locksField,
            },
          ],
          pendingGuess: null,
          status: "won",
          revealedTarget: body.target,
        }));
        setInput("");
      } else if (body.kind === "lost") {
        setState((s) => ({
          ...s,
          guesses: [
            ...s.guesses,
            { guess: v.digits, ...locksField },
          ],
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
          pendingGuess: {
            guess: v.digits,
            options: opts,
            ...locksField,
          },
        }));
        setInput("");
      } else {
        setError("unexpected_response");
      }
      // Clear the turn's lock state here, in the same sync context as
      // setState, so React batches them into one render. Prior code
      // used an effect that fired after `hasPending` flipped, which
      // cost a visible extra frame (more noticeable with two locks).
      setLockedSlots([]);
      setPendingLockSlot(null);
    } catch {
      setError("network_error");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [input, state, certain, lockedSlots, pendingLockSlot]);

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
          const pendingLocks = pending.locks;
          setState((s) => ({
            ...s,
            guesses: [
              ...s.guesses,
              {
                guess: pending.guess,
                clueId,
                result: body.result,
                ...(pendingLocks && pendingLocks.length > 0
                  ? { locks: pendingLocks }
                  : {}),
              },
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
  };
}
