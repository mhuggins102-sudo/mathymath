"use client";

import { CLUES } from "@/lib/game/clues/registry";
import { ClueBadge } from "./ClueBadge";
import { Digit } from "./Digit";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const EXAMPLE_TARGET = "47381";

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-md mx-auto p-4 pb-24">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">How to play</h2>
          <button
            type="button"
            className="text-muted hover:text-foreground text-sm px-2 py-1"
            onClick={onClose}
          >
            Close ✕
          </button>
        </div>

        <div className="space-y-3 text-sm text-muted leading-relaxed mb-6">
          <p>
            Guess the secret 5-digit number in 8 tries. Digits can repeat (e.g., <span className="digit-7 font-mono">7</span><span className="digit-4 font-mono">4</span><span className="digit-7 font-mono">7</span><span className="digit-2 font-mono">2</span><span className="digit-7 font-mono">7</span>).
          </p>
          <p>
            After each guess you&apos;ll be offered <strong className="text-foreground">two clue options</strong>. Pick the one that will help you most. Some clues tell you about specific slots (<span className="text-accent">positional</span>), others about the whole number (<span className="text-warn">compositional</span>).
          </p>
          <p>
            Typical game takes 4–6 guesses. Plan your clues.
          </p>
        </div>

        <h3 className="text-sm uppercase tracking-wider text-muted mb-3">
          Clue types — example target{" "}
          <span className="font-mono font-bold">
            {[...EXAMPLE_TARGET].map((d, i) => (
              <span key={i} className={`digit-${d}`}>
                {d}
              </span>
            ))}
          </span>
        </h3>

        <div className="space-y-3">
          {CLUES.map((clue) => {
            const { guess, result } = clue.example(EXAMPLE_TARGET);
            return (
              <div
                key={clue.id}
                className="bg-surface rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{clue.name}</span>
                  <span
                    className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                      clue.category === "positional"
                        ? "bg-accent/20 text-accent"
                        : "bg-warn/20 text-warn"
                    }`}
                  >
                    {clue.category}
                  </span>
                </div>
                <p className="text-xs text-muted mb-2">{clue.description}</p>
                <div className="flex items-center justify-center gap-1 mb-2">
                  <span className="text-[10px] text-muted mr-1">guess:</span>
                  {[...guess].map((d, i) => (
                    <Digit key={i} value={d} size="sm" filled />
                  ))}
                </div>
                <div className="flex justify-center">
                  <ClueBadge result={result} guess={guess} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
