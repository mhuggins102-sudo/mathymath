"use client";

import { GuessRow } from "./GuessRow";
import type { GameState } from "@/lib/game/stateMachine";

interface GuessGridProps {
  state: GameState;
  currentInput: string;
}

export function GuessGrid({ state, currentInput }: GuessGridProps) {
  const rows: React.ReactNode[] = [];

  // Already-resolved guesses
  for (const g of state.guesses) {
    rows.push(
      <GuessRow
        key={`done-${rows.length}`}
        guess={g.guess}
        digits={state.digits}
        result={g.result}
      />,
    );
  }

  // Pending (awaiting clue choice) row
  if (state.pendingGuess) {
    rows.push(
      <GuessRow
        key={`pending`}
        guess={state.pendingGuess.guess}
        digits={state.digits}
        pending
        active
      />,
    );
  } else if (state.status === "playing") {
    // Current input row (typing)
    rows.push(
      <GuessRow
        key="current"
        guess={currentInput}
        digits={state.digits}
        active
      />,
    );
  }

  // Remaining empty rows up to maxGuesses.
  const shownRows =
    state.guesses.length + (state.pendingGuess || state.status === "playing" ? 1 : 0);
  for (let i = shownRows; i < state.maxGuesses; i++) {
    rows.push(<GuessRow key={`empty-${i}`} guess="" digits={state.digits} />);
  }

  return <div className="w-full flex flex-col gap-1">{rows}</div>;
}
