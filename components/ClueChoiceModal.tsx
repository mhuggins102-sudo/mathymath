"use client";

import type { Clue } from "@/lib/game/clues/types";

interface ClueChoiceModalProps {
  open: boolean;
  options: [Clue, Clue] | null;
  onChoose: (id: Clue["id"]) => void;
}

export function ClueChoiceModal({ open, options, onChoose }: ClueChoiceModalProps) {
  if (!open || !options) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a clue"
    >
      <div className="w-full max-w-md bg-surface rounded-xl border border-border p-4 shadow-2xl">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3 text-center">
          Pick a clue
        </h2>
        <div className="grid gap-3">
          {options.map((clue) => (
            <button
              key={clue.id}
              type="button"
              className="text-left bg-surface-2 hover:bg-surface-2/80 active:scale-[0.99] transition rounded-lg px-4 py-3 border border-border"
              onClick={() => onChoose(clue.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-foreground">{clue.name}</span>
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${
                    clue.category === "positional"
                      ? "bg-accent/20 text-accent"
                      : "bg-warn/20 text-warn"
                  }`}
                >
                  {clue.category}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{clue.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
