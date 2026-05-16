"use client";

import { useEffect, useState } from "react";
import { CLUES } from "@/lib/game/clues/registry";
import { ROUND1_CURATED_CLUE_IDS } from "@/lib/game/clueSelector";
import { CLUE_REUSE_CLUE_ID, CLUE_REUSE_COST } from "@/lib/game/locks";
import { GuessRow } from "./GuessRow";
import { ClueLegend } from "./ClueLegend";
import { Modal } from "./Modal";

type AccordionId = "basics" | "clues" | "locks" | "tips";

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
  // Mutually-exclusive accordion state. "The basics" starts open;
  // opening any other section closes the previous one, and clicking
  // the open one again collapses everything. Reset on every
  // modal-open so the player always lands on the same first section.
  const [openSection, setOpenSection] = useState<AccordionId | null>("basics");
  useEffect(() => {
    if (open) setOpenSection("basics");
  }, [open]);
  const toggleSection = (id: AccordionId) =>
    setOpenSection((cur) => (cur === id ? null : id));

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

        <div className="space-y-2 mb-6">
          <Accordion
            title="The basics"
            isOpen={openSection === "basics"}
            onToggle={() => toggleSection("basics")}
          >
            <p>
              Guess the secret 5-digit number in 7 tries. Digits can
              repeat — e.g.{" "}
              <span className="font-mono text-foreground">74727</span> is a
              valid target.
            </p>
            <p>
              Unlimited mode adds a harder 6-digit variant with the same
              7-tries budget. Toggle it in{" "}
              <span className="text-foreground">Settings</span>.
            </p>
          </Accordion>

          <Accordion
            title="Choosing clues"
            isOpen={openSection === "clues"}
            onToggle={() => toggleSection("clues")}
          >
            <p>
              After every guess you&apos;re offered{" "}
              <strong className="text-foreground">two clue options</strong>.
              Pick the one that will help you most given what the row
              already tells you.
            </p>
            <p>
              On round 1, friendly opener clues are marked with a{" "}
              <span className="text-warn">⭐</span> in the chooser — those
              are the ones most useful to play first.
            </p>
            <p>
              A clue type can only be picked once per game — used types
              won&apos;t reappear as future options.
            </p>
          </Accordion>

          <Accordion
            title="Locks"
            isOpen={openSection === "locks"}
            onToggle={() => toggleSection("locks")}
          >
            <p>
              You start each game with one{" "}
              <span className="text-foreground">🔒 lock</span>. Tap a cell
              on the active row to pin a digit you&apos;re sure of. Correct
              locks stay across guesses; wrong locks are spent.
            </p>
            <p>
              You can also spend a lock to{" "}
              <strong className="text-foreground">redraw</strong> the
              offered clue pair, or pick{" "}
              <strong className="text-foreground">Clue Reuse</strong>{" "}
              (costs 1 🔒) to repeat a previously-used clue.
            </p>
            <p>
              Hard Unlimited starts with zero locks — you can still earn
              them via Extra Lock during the game.
            </p>
          </Accordion>

          <Accordion
            title="Tips & strategy"
            isOpen={openSection === "tips"}
            onToggle={() => toggleSection("tips")}
          >
            <p>
              Your guess doesn&apos;t have to be your best estimate of the
              target. A strategic guess — like all 5s — often extracts more
              information from the clue you&apos;re hoping to receive.
            </p>
            <p>
              Tap a clue&apos;s name on a resolved row to see exactly how
              its result was computed against your guess.
            </p>
          </Accordion>
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

/** Controlled accordion section. Built on a button + conditional
 *  panel rather than native <details> so the parent can enforce
 *  mutual exclusion (only one open at a time). The chevron rotates
 *  via a class swap. */
function Accordion({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-2/50 rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between cursor-pointer select-none px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
      >
        <span>{title}</span>
        <span
          aria-hidden
          className={`text-muted text-xs transition-transform ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 text-sm text-muted leading-relaxed space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
