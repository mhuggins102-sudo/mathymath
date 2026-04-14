"use client";

import type { Clue, ClueId } from "@/lib/game/clues/types";

interface ClueChooserProps {
  options: [Clue, Clue];
  onChoose: (id: ClueId) => void;
}

/**
 * Inline clue picker rendered in place of the keypad after a guess is
 * submitted. Two options, tap to reveal. Unlike a modal, the guess grid
 * above stays visible so the player can reason about prior clues before
 * picking.
 */
export function ClueChooser({ options, onChoose }: ClueChooserProps) {
  return (
    <div className="w-full max-w-md mx-auto select-none">
      <p className="text-center text-[10px] uppercase tracking-wider text-muted mb-2">
        Pick a clue
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((clue) => (
          <button
            key={clue.id}
            type="button"
            onClick={() => onChoose(clue.id)}
            className="text-left bg-surface-2 hover:bg-surface-2/80 active:scale-[0.99] transition rounded-lg px-3 py-3 border border-border"
          >
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="font-semibold text-sm text-foreground truncate">
                {clue.name}
              </span>
              <span
                className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                  clue.category === "positional"
                    ? "bg-accent/20 text-accent"
                    : "bg-warn/20 text-warn"
                }`}
              >
                {clue.category === "positional" ? "pos" : "comp"}
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug line-clamp-3">
              {clue.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
