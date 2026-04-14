"use client";

import type { Clue, ClueId } from "@/lib/game/clues/types";
import { ClueLegend } from "./ClueLegend";

interface ClueChooserProps {
  options: [Clue, Clue];
  onChoose: (id: ClueId) => void;
}

/**
 * Inline clue picker rendered in place of the keypad after a guess is
 * submitted. Stacked vertically (full width) so each clue's description
 * can render on multiple lines without truncation.
 */
export function ClueChooser({ options, onChoose }: ClueChooserProps) {
  return (
    <div className="w-full max-w-md mx-auto select-none">
      <p className="text-center text-[10px] uppercase tracking-wider text-muted mb-2">
        Pick a clue
      </p>
      <div className="flex flex-col gap-2">
        {options.map((clue) => (
          <button
            key={clue.id}
            type="button"
            onClick={() => onChoose(clue.id)}
            className="w-full text-left bg-surface-2 hover:bg-surface-2/80 active:scale-[0.99] transition rounded-lg px-4 py-3 border border-border"
          >
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="font-semibold text-foreground">{clue.name}</span>
              <span
                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                  clue.category === "positional"
                    ? "bg-accent/20 text-accent"
                    : "bg-warn/20 text-warn"
                }`}
              >
                {clue.category}
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {clue.description}
            </p>
            {clue.legend && <ClueLegend entries={clue.legend} />}
          </button>
        ))}
      </div>
    </div>
  );
}
