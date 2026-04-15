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
}

/**
 * Renders only the rows that actually exist:
 *  - every resolved guess (with its revealed clue)
 *  - either the pending (awaiting-clue) row OR the current-input row,
 *    but never both
 *  - NO empty padding rows beneath — the next row appears only after
 *    the current one is resolved.
 */
export function GuessGrid({ state, currentInput }: GuessGridProps) {
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
    rows.push(
      <GuessRow
        key="pending"
        guess={state.pendingGuess.guess}
        digits={state.digits}
        pending
        active
      />,
    );
  } else if (state.status === "playing") {
    rows.push(
      <GuessRow
        key="current"
        guess={currentInput}
        digits={state.digits}
        active
      />,
    );
  }

  return <div className="w-full flex flex-col gap-1">{rows}</div>;
}
