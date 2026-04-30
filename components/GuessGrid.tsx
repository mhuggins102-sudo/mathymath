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
  /** Tightens cell sizing so wider rows (6 digits) fit alongside the
   *  clue label on phone-width viewports. */
  compact?: boolean;
}

/**
 * True for the last resolved guess when the game ended in an
 * Oracle-induced win (Oracle revealed the final unknown slot, possibly
 * via Clue Reuse). The row should be repainted to look like a literal
 * correct guess — full target shown, every slot in match state — even
 * though the player's typed guess wasn't the target.
 */
export function isOracleWinRow(
  state: Pick<GuessGridState, "status" | "guesses">,
  rowIndex: number,
): boolean {
  if (state.status !== "won") return false;
  if (rowIndex !== state.guesses.length - 1) return false;
  return state.guesses[rowIndex]?.result?.kind === "oracle";
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
  compact,
}: GuessGridProps) {
  const rows: React.ReactNode[] = [];

  for (let i = 0; i < state.guesses.length; i++) {
    const g = state.guesses[i];
    const isOracleWin = isOracleWinRow(state, i);
    rows.push(
      <GuessRow
        key={`done-${i}`}
        guess={g.guess}
        digits={state.digits}
        result={g.result}
        locks={g.locks}
        interactive
        compact={compact}
        winRow={isOracleWin}
        certainDigits={isOracleWin ? certainDigits : undefined}
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
        compact={compact}
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
        compact={compact}
      />,
    );
  }

  return <div className="w-full flex flex-col gap-1">{rows}</div>;
}
