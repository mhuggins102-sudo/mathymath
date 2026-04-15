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
  guesses: Array<{ guess: string; clueId?: ClueId; result?: ClueResult }>;
  pendingGuess: { guess: string; options: [Clue, Clue] } | null;
}

interface GuessGridProps {
  state: GuessGridState;
  currentInput: string;
  /** Per-slot digits known-certain from prior clues. When supplied, the
   *  active (entering) row auto-fills these cells in the match state
   *  and the player's typed input fills only non-certain slots. */
  certainDigits?: (string | null)[];
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
        interactive
      />,
    );
  }

  if (state.pendingGuess) {
    // Pending row: the full (certain + typed) guess has already been
    // assembled by useGame on submit, so we just render it. certainDigits
    // is passed so cells that are certain paint in match state even
    // though there's no clue result yet.
    rows.push(
      <GuessRow
        key="pending"
        guess={state.pendingGuess.guess}
        digits={state.digits}
        pending
        active
        certainDigits={certainDigits}
      />,
    );
  } else if (state.status === "playing") {
    // Active typing row: currentInput is just the player's typed string,
    // not a full guess. GuessRow will interleave certainDigits into the
    // rendered cells.
    rows.push(
      <GuessRow
        key="current"
        guess={currentInput}
        digits={state.digits}
        active
        certainDigits={certainDigits}
      />,
    );
  }

  return <div className="w-full flex flex-col gap-1">{rows}</div>;
}
