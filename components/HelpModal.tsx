"use client";

import { CLUES } from "@/lib/game/clues/registry";
import { GuessRow } from "./GuessRow";
import { ClueLegend } from "./ClueLegend";
import { Modal } from "./Modal";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * A deliberately diverse example target:
 *  - all 5 digits unique (0 gone — won't clash with the "5 unique digits"
 *    hint and isn't a leading zero either)
 *  - mix of even (4, 6, 2, 8) and odd (7)
 *  - 2 prime digits (7, 2)
 *  - range of 6 (max 8, min 2)
 *  - median 6
 *  - divisible by 2, 3, 4, 6, 9 — gives Divisible By something to pick
 *  - sum 27
 * Perfect for showing off every clue.
 */
const EXAMPLE_TARGET = "47628";

export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} titleId="help-modal-title" variant="full">
      <div className="max-w-md mx-auto p-4 pb-24">
        <div className="flex justify-between items-center mb-4">
          <h2 id="help-modal-title" className="text-xl font-semibold">
            How to play
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-center min-h-11 px-3 rounded-md text-muted hover:text-foreground active:bg-surface-2 text-sm"
            onClick={onClose}
          >
            Close ✕
          </button>
        </div>

        <div className="space-y-3 text-sm text-muted leading-relaxed mb-6">
          <p>
            Guess the secret 5-digit number in 7 tries. Digits can repeat
            (e.g. <span className="font-mono text-foreground">74727</span>).
          </p>
          <p>
            After each guess you&apos;ll be offered{" "}
            <strong className="text-foreground">two clue options</strong>.
            Pick the one that will help you most.{" "}
            <span className="text-accent">Positional</span> clues color the
            cells; <span className="text-warn">compositional</span> clues
            tell you something about the whole number;{" "}
            <span className="text-good">special</span> cards change the
            rules (e.g. grant an extra lock).
          </p>
          <p>
            You also start each game with one{" "}
            <span className="text-foreground">🔒 lock</span> — from guess 2
            on, tap a cell to pin a digit you&apos;re sure of. Correct locks
            stay; wrong locks are spent.
          </p>
          <p>
            A clue type can only be chosen once per game — used types
            won&apos;t appear as future options.
          </p>
        </div>

        <h3 className="text-sm uppercase tracking-wider text-muted mb-3">
          Clue reference — example target{" "}
          <span className="font-mono font-bold text-foreground">
            {EXAMPLE_TARGET}
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
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{clue.name}</span>
                  <span
                    className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                      clue.category === "positional"
                        ? "bg-accent/20 text-accent"
                        : clue.category === "compositional"
                        ? "bg-warn/20 text-warn"
                        : "bg-good/20 text-good"
                    }`}
                  >
                    {clue.category}
                  </span>
                </div>
                <p className="text-xs text-muted mb-2 leading-relaxed">
                  {clue.description}
                </p>
                {clue.legend && <ClueLegend entries={clue.legend} />}
                <div className="scale-90 origin-left mt-2">
                  <GuessRow
                    guess={guess}
                    digits={guess.length}
                    result={result}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
