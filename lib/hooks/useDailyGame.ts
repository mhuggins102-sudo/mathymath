"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Clue, ClueId, ClueParam, ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { validateGuess } from "@/lib/game/validator";
import {
  loadDailyGame,
  saveDailyGame,
  type SavedDailyGame,
} from "@/lib/persistence/localStore";
import {
  buildGuessFromInput,
  deriveCertainDigits,
  inputCapacity,
} from "@/lib/game/certain";
import { pickTwoClues } from "@/lib/game/clueSelector";
import {
  canUseLockOnGuess,
  CLUE_REUSE_CLUE_ID,
  CLUE_REUSE_COST,
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
    redraws?: number;
  }>;
  /** Cumulative deck-position offset caused by redraws. */
  deckOffset: number;
  pendingGuess: {
    guess: string;
    options: [Clue, Clue];
    locks?: LockRecord[];
    redraws: number;
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
  unlockMode: boolean;
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
  redraw: () => void;
  canRedraw: boolean;
  appendDigit: (d: string) => void;
  backspace: () => void;
  submit: () => void;
  chooseClue: (id: ClueId) => void;
  confirmClueParam: (param: ClueParam) => void;
  cancelClueParam: () => void;
  pickContainsDigit: (slot: number) => void;
  tapCell: (slot: number) => void;
  commitLock: () => void;
}

function initialState(config: UseDailyGameConfig): DailyGameState {
  return {
    date: config.date,
    digits: config.digits,
    maxGuesses: config.maxGuesses,
    guesses: [],
    deckOffset: 0,
    pendingGuess: null,
    status: "playing",
    revealedTarget: null,
  };
}

/** Exported for unit tests. Hook consumers should not call this — use
 *  the hook itself, which wires saveDailyGame on every state change. */
export function toSaved(state: DailyGameState): SavedDailyGame {
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
      // `redraws` MUST round-trip: the /api/results replay uses it to
      // reconstruct the deck offset (each redraw advances the pair
      // pointer). Dropping it here means a hydrated game's resubmit
      // hits clue_not_offered → history_invalid, even though the
      // first-time submit (from in-memory state) succeeded.
      redraws: g.redraws,
    })),
    pendingGuess: state.pendingGuess
      ? {
          guess: state.pendingGuess.guess,
          optionIds: [
            state.pendingGuess.options[0].id,
            state.pendingGuess.options[1].id,
          ],
          locks: state.pendingGuess.locks,
          redraws: state.pendingGuess.redraws,
        }
      : null,
    status: state.status,
    revealedTarget: state.revealedTarget,
  };
}

/** Exported for unit tests. See toSaved above. */
export function fromSaved(
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
        redraws: saved.pendingGuess.redraws ?? 0,
      };
    } catch {
      // Unknown clue id (e.g. a retired clue in older saves). Drop
      // pending and let the player resubmit.
      pendingGuess = null;
    }
  }
  // Derive deckOffset from stored redraws history so the deck pointer
  // picks up where it left off after a page refresh.
  const restoredGuesses = saved.guesses.map((g) => ({
    guess: g.guess,
    clueId: g.clueId as ClueId | undefined,
    result: g.result as ClueResult | undefined,
    locks: g.locks,
    redraws: g.redraws as number | undefined,
  }));
  let deckOffset = 0;
  for (const g of restoredGuesses) deckOffset += g.redraws ?? 0;

  return {
    date: saved.date,
    digits: saved.digits,
    maxGuesses: saved.maxGuesses,
    guesses: restoredGuesses,
    deckOffset,
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
    redraws: g.redraws,
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
  const [unlockMode, setUnlockMode] = useState(false);
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

  // Base budget = locks remaining after the resolved-history accounting.
  // While a guess is pending (clue chooser is up), every lock placed on
  // this turn — correct OR incorrect — counts against the displayed
  // budget along with any redraws taken. Correct locks are refunded
  // when the round closes (the resolved guess lands in state.guesses
  // and the spec-level locksAvailable formula no longer treats them as
  // spent). The strict-during-chooser display matches the player's
  // mental model that a placed lock and a redraw are both "uses" of a
  // lock budget, and prevents Clue Reuse from looking affordable when
  // the same-turn refund hasn't actually happened yet.
  const baseLocksAvailable = computeLocksAvailable(state.guesses);
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

  const cancelPendingLock = useCallback((): {
    locked: LockAttempt[];
    inp: string;
  } => {
    if (pendingLockSlot === null) return { locked: [...lockedSlots], inp: input };
    if (unlockMode) return { locked: [...lockedSlots], inp: input };
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

      if (pendingLockSlot === slot) {
        const { locked, inp } = cancelPendingLock();
        setLockedSlots(locked);
        setInput(inp);
        setPendingLockSlot(null);
        setUnlockMode(false);
        return;
      }

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
        setLockedSlots(effectiveLocked);
        setInput(effectiveInput);
        setPendingLockSlot(slot);
        setUnlockMode(true);
        return;
      }

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
      // Unlock: remove lock. Cell goes blank (digit not restored).
      const newLocked = lockedSlots.filter((l) => l.slot !== pendingLockSlot);
      setLockedSlots(newLocked);
      setPendingLockSlot(null);
      setUnlockMode(false);
      return;
    }
    if (pendingLockDigit === null) return;
    setPendingLockSlot(null);
    setUnlockMode(false);
  }, [pendingLockSlot, pendingLockDigit, unlockMode, lockedSlots]);

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
            redraws: 0,
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

  // --- Clue-parameter selection (Oracle slot / Contains Digit digit) ---
  // For Contains Digit specifically, `picks` accumulates the round's
  // per-pick yes/no resolutions across the multi-pick UI. Each pick
  // is a server round-trip (the client doesn't know the target), so
  // the partial picks come back from the server's "needs-pick"
  // response.
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

  /** Internal: actually fires the choose-clue server call once we
   *  have both the clueId and (optionally) the player's param. */
  const doChooseClue = useCallback(
    async (clueId: ClueId, clueParam?: ClueParam) => {
      if (inFlightRef.current) return;
      if (!state.pendingGuess || state.status !== "playing") return;
      const pending = state.pendingGuess;
      inFlightRef.current = true;
      setError(null);
      setLoading(true);
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
              ...(clueParam ? { clueParam } : {}),
              redraws: pending.redraws ?? 0,
              // Pending guess's resolved locks travel separately so the
              // server can include them in the Oracle-win certain-digits
              // check (an Oracle reveal that completes the target only
              // when combined with a correct lock placed this turn).
              ...(pending.locks && pending.locks.length > 0
                ? { pendingLocks: pending.locks }
                : {}),
            }),
          },
        );
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "server_error");
          return;
        }
        if (body.kind === "needs-pick") {
          // Contains Digit interactive: the round isn't done yet.
          // Update the picker's local state with the partial picks
          // returned by the server, and leave pendingGuess intact so
          // the player can pick another slot.
          setPendingClueParam((prev) =>
            prev
              ? {
                  ...prev,
                  picks: (body.partialPicks ?? []) as {
                    slot: number;
                    digit: number;
                    present: boolean;
                    exact: boolean;
                  }[],
                }
              : null,
          );
          return;
        }
        if (body.kind === "continue" || body.kind === "won") {
          const pendingLocks = pending.locks;
          const pendingRedrawCount = pending.redraws ?? 0;
          const isOracleWin = body.kind === "won";
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
                ...(pendingRedrawCount > 0
                  ? { redraws: pendingRedrawCount }
                  : {}),
              },
            ],
            pendingGuess: null,
            ...(isOracleWin
              ? { status: "won" as const, revealedTarget: body.target }
              : {}),
          }));
          // Clear pending param state on successful resolution so the
          // chooser/digit-picker UI doesn't linger past the round.
          setPendingClueParam(null);
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

  const chooseClue = useCallback(
    (clueId: ClueId) => {
      if (!state.pendingGuess) return;
      const clue = state.pendingGuess.options.find((c) => c.id === clueId);
      if (!clue) return;
      // Defensive: refuse Clue Reuse when the lock budget can't cover
      // its cost. The chooser button is disabled in that state too;
      // this guards against a stale render or a programmatic call.
      if (
        clueId === CLUE_REUSE_CLUE_ID &&
        locksAvailableCount < CLUE_REUSE_COST
      ) {
        return;
      }
      if (clue.paramKind) {
        setPendingClueParam({ clueId, paramKind: clue.paramKind });
        return;
      }
      doChooseClue(clueId);
    },
    [state.pendingGuess, doChooseClue, locksAvailableCount],
  );

  const confirmClueParam = useCallback(
    (param: ClueParam) => {
      if (!pendingClueParam) return;
      // Chained flow for Clue Reuse → Contains Digit: enter the
      // multi-pick picker before dispatching. Oracle reused via Clue
      // Reuse needs no sub-picker — it auto-picks its slot now.
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
          // Fall through.
        }
      }
      const mergedParam = pendingClueParam.reusedClueId
        ? { ...param, reusedClueId: pendingClueParam.reusedClueId }
        : param;
      doChooseClue(pendingClueParam.clueId as ClueId, mergedParam);
      setPendingClueParam(null);
    },
    [pendingClueParam, doChooseClue],
  );

  const cancelClueParam = useCallback(() => {
    setPendingClueParam(null);
  }, []);

  const pickContainsDigit = useCallback(
    (slot: number) => {
      if (!pendingClueParam || pendingClueParam.paramKind !== "slot") return;
      const priorSlots = (pendingClueParam.picks ?? []).map((p) => p.slot);
      const newSlots = [...priorSlots, slot];
      const param = pendingClueParam.reusedClueId
        ? { picks: newSlots, reusedClueId: pendingClueParam.reusedClueId }
        : { picks: newSlots };
      void doChooseClue(pendingClueParam.clueId as ClueId, param);
    },
    [pendingClueParam, doChooseClue],
  );

  // Redraw: burn a lock to discard the current pair and advance the
  // deck. Computed locally (pickTwoClues is shared lib, seed = date).
  // The server validates the final choice via the redraws count sent
  // in the choose-clue request. locksAvailableCount already subtracts
  // this turn's wrong locks and prior redraws, so a positive budget is
  // sufficient to afford one more redraw.
  const canRedraw =
    !!state.pendingGuess && !pendingClueParam && locksAvailableCount > 0;

  const redraw = useCallback(() => {
    if (!canRedraw || !state.pendingGuess) return;
    const newOffset = state.deckOffset + 1;
    const usedClueIds = state.guesses
      .map((g) => g.clueId)
      .filter((id): id is ClueId => id !== undefined);
    const newPair = pickTwoClues(state.date, usedClueIds, newOffset);
    setState((s) => ({
      ...s,
      deckOffset: newOffset,
      pendingGuess: s.pendingGuess
        ? {
            ...s.pendingGuess,
            options: newPair,
            redraws: (s.pendingGuess.redraws ?? 0) + 1,
          }
        : null,
    }));
  }, [canRedraw, state.pendingGuess, state.deckOffset, state.guesses, state.date]);

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
    unlockMode,
    pendingClueParam,
    redraw,
    canRedraw,
    appendDigit,
    backspace,
    submit,
    chooseClue,
    confirmClueParam,
    cancelClueParam,
    pickContainsDigit,
    tapCell,
    commitLock,
  };
}
