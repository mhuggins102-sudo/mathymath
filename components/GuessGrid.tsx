"use client";

import { GuessRow } from "./GuessRow";
import type { Clue, ClueId, ClueResult } from "@/lib/game/clues/types";

/**
 * Structural state shape GuessGrid needs — narrower than the full
 * GameState so that the daily-mode state (which has no `target`) is
 * also assignable. Unlimited mode passes its full GameState; daily mode
 * passes DailyGameState. Both satisfy this shape.
 */
export interface GuessGridState {
  digits: number;
  status: "playing" | "won" | "lost";
  guesses: Array<{
    guess: string;
    clueId?: ClueId;
    result?: ClueResult;
    locks?: readonly { slot: number; digit: string; correct: boolean }[];
  }>;
  pendingGuess: {
    guess: string;
    options: [Clue, Clue];
    locks?: readonly { slot: number; digit: string; correct: boolean }[];
  } | null;
}

interface GuessGridProps {
  state: GuessGridState;
  currentInput: string;
  /** Per-slot digits known-certain from prior clues. When supplied, the
   *  active (entering) row auto-fills these cells in the match state
   *  and the player's typed input fills only non-certain slots. */
  certainDigits?: (string | null)[];
  /** Locks committed this turn (not yet submitted). Drives the
   *  locked-pending visual on the active row. */
  lockedSlots?: readonly { slot: number; digit: string }[];
  /** Slot currently in lock-entry mode. */
  pendingLockSlot?: number | null;
  /** Tap handler for cells on the active row (initiates / cancels a
   *  lock selection). */
  onTapCell?: (slot: number) => void;
}

/**
 * Renders only the rows that actually exist:
 *  - every resolved guess (with its revealed clue)
 *  - either the pending (awaiting-clue) row OR the current-input row,
 *    but never both
 *  - NO empty padding rows beneath — the next row appears only after
 *    the current one is resolved.
 */
export function GuessGrid({
  state,
  currentInput,
  certainDigits,
  lockedSlots,
  pendingLockSlot,
  onTapCell,
}: GuessGridProps) {
  const rows: React.ReactNode[] = [];

  for (let i = 0; i < state.guesses.length; i++) {
    const g = state.guesses[i];
    rows.push(
      <GuessRow
        key={`done-${i}`}
        guess={g.guess}
        digits={state.digits}
        result={g.result}
        locks={g.locks}
        interactive
      />,
    );
  }

  if (state.pendingGuess) {
    // Pending row: the full (certain + locks + typed) guess has already
    // been assembled by the reducer on submit. The pendingGuess.locks
    // drive the locked-pending badges; certainDigits paints certain
    // slots even before the clue is picked.
    rows.push(
      <GuessRow
        key="pending"
        guess={state.pendingGuess.guess}
        digits={state.digits}
        pending
        active
        certainDigits={certainDigits}
        lockedSlots={state.pendingGuess.locks}
      />,
    );
  } else if (state.status === "playing") {
    // Active typing row: currentInput is just the player's typed string,
    // not a full guess. GuessRow interleaves certain + locks + typed.
    rows.push(
      <GuessRow
        key="current"
        guess={currentInput}
        digits={state.digits}
        active
        certainDigits={certainDigits}
        lockedSlots={lockedSlots}
        pendingLockSlot={pendingLockSlot}
        onTapCell={onTapCell}
      />,
    );
  }

  return <div className="w-full flex flex-col gap-1">{rows}</div>;
}
