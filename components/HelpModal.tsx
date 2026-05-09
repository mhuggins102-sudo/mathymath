"use client";

import { CLUES } from "@/lib/game/clues/registry";
import { ROUND1_CURATED_CLUE_IDS } from "@/lib/game/clueSelector";
import { CLUE_REUSE_CLUE_ID, CLUE_REUSE_COST } from "@/lib/game/locks";
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
    <Modal open={open} onClose={onClose} titleId="help-modal-title" variant="overlay">
      <div className="bg-surface rounded-xl border border-border shadow-2xl p-4">
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
            Guess the secret 5-digit number in 8 tries. Digits can repeat
            (e.g. <span className="font-mono text-foreground">74727</span>).
            Unlimited mode also offers a harder 6-digit variant with the
            same 8-tries budget.
          </p>
          <p>
            After each guess you&apos;ll be offered{" "}
            <strong className="text-foreground">two clue options</strong>.
            Pick the one that will help you most. On round 1, friendly
            opener clues are marked with a{" "}
            <span className="text-warn">⭐</span> in the chooser — these are
            the ones most useful to play first.
          </p>
          <p>
            You start each game with one{" "}
            <span className="text-foreground">🔒 lock</span> (Advanced
            unlimited mode starts with zero — you can still earn locks via
            Extra Lock). Tap a cell on any guess to pin a digit you&apos;re
            sure of. Correct locks stay; wrong locks are spent. You can
            also spend a lock to{" "}
            <strong className="text-foreground">redraw</strong> the offered
            clue pair if neither option appeals, and{" "}
            <strong className="text-foreground">Clue Reuse</strong> costs 1
            lock per use.
          </p>
          <p>
            A clue type can only be chosen once per game — used types
            won&apos;t appear as future options.
          </p>
          <p className="text-foreground/80 italic">
            Tip: your guess doesn&apos;t have to be your best estimate of the
            target. A strategic guess — like all 5s — can extract more
            information from the clue you&apos;re hoping to receive.
          </p>
        </div>

        <h3 className="text-sm uppercase tracking-wider text-muted mb-3">
          Clue reference — example target{" "}
          <span className="font-mono font-bold text-foreground">
            {EXAMPLE_TARGET}
          </span>
        </h3>

        <div className="space-y-3">
          {[...CLUES]
            // Curated round-1 clues bubble to the top so a new player
            // sees the friendly openers first. The rest preserve the
            // registry's existing order.
            .sort((a, b) => {
              const ar = ROUND1_CURATED_CLUE_IDS.has(a.id) ? 0 : 1;
              const br = ROUND1_CURATED_CLUE_IDS.has(b.id) ? 0 : 1;
              return ar - br;
            })
            .map((clue) => {
              const { guess, result } = clue.example(EXAMPLE_TARGET);
              const isCurated = ROUND1_CURATED_CLUE_IDS.has(clue.id);
              return (
                <div
                  key={clue.id}
                  className="bg-surface rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-semibold text-sm inline-flex items-center gap-1.5">
                      {clue.name}
                      {clue.id === CLUE_REUSE_CLUE_ID && (
                        <span className="text-[10px] font-normal text-muted">
                          🔒×{CLUE_REUSE_COST}
                        </span>
                      )}
                    </span>
                    {isCurated && (
                      <span
                        className="text-warn text-sm shrink-0"
                        title="Curated turn-1 clue"
                        aria-label="Curated turn-1 clue"
                      >
                        ⭐
                      </span>
                    )}
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
