"use client";

import { useEffect, useState } from "react";
import { CLUES } from "@/lib/game/clues/registry";
import { ROUND1_CURATED_CLUE_IDS } from "@/lib/game/clueSelector";
import { GuessRow } from "./GuessRow";
import { ClueLegend } from "./ClueLegend";
import { ClueLockBadge } from "./ClueLockBadge";
import { Modal } from "./Modal";

type AccordionId =
  | "basics"
  | "modes"
  | "clues"
  | "colors"
  | "locks"
  | "settings"
  | "stats"
  | "tips";

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
  // Mutually-exclusive accordion state. All sections start collapsed
  // so the modal opens to a clean overview the player can scan; they
  // expand whichever section they want. Opening any other section
  // closes the previous one, and clicking the open one again
  // collapses everything. Reset on every modal-open so the player
  // always lands on the same all-collapsed state.
  const [openSection, setOpenSection] = useState<AccordionId | null>(null);
  useEffect(() => {
    if (open) setOpenSection(null);
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
              Guess the secret 5-digit number in{" "}
              <strong className="text-foreground">7 tries</strong>. Digits
              can repeat — e.g.{" "}
              <span className="font-mono text-foreground">74727</span> is a
              valid target.
            </p>
            <p>
              Each guess is scored by a{" "}
              <strong className="text-foreground">clue</strong> you pick
              from a two-option chooser. The clue paints the row with
              colors — match (green), warm (info), cold (info), or idle
              (no info) — that progressively narrow the target.
            </p>
            <p>
              Win by submitting the exact target before you run out of
              turns. Wrong guesses still resolve their clue and stay on
              the board as evidence.
            </p>
          </Accordion>

          <Accordion
            title="Game modes"
            isOpen={openSection === "modes"}
            onToggle={() => toggleSection("modes")}
          >
            <p>
              <strong className="text-foreground">Daily.</strong> One fixed
              puzzle per day, same target for everyone. Fixed settings
              (5-digit, Normal, Manual). Results are shareable and a
              daily streak is tracked.
            </p>
            <p>
              <strong className="text-foreground">Unlimited.</strong> Play
              as many games as you want with adjustable settings — number
              length, difficulty, and clue selection. Personal stats and
              streaks are recorded per setting bucket.
            </p>
            <p>
              Tap the gear (⚙︎) icon to open Settings; tap the trophy
              icon to see your Achievements and stats.
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
              are designed for the first-guess sweep.
            </p>
            <p>
              A clue type can only be picked once per game — used types
              won&apos;t reappear as future options (unless you spend a
              lock on Clue Reuse).
            </p>
            <p>
              The full clue reference is shown below this list. Tap any
              clue&apos;s name on a resolved row mid-game to see exactly
              how its result was computed against your guess.
            </p>
          </Accordion>

          <Accordion
            title="Cell colors"
            isOpen={openSection === "colors"}
            onToggle={() => toggleSection("colors")}
          >
            <p>
              The colors painted on a resolved row mean:
            </p>
            <ul className="list-disc list-outside pl-5 space-y-1">
              <li>
                <span className="text-good">Green</span> — match. The slot
                holds the target&apos;s digit (Bullseyes, Higher-or-Lower
                &quot;equal&quot;, Contains Digit &quot;exact&quot;,
                Oracle reveals, or a correct lock).
              </li>
              <li>
                <span className="text-warn">Warm</span> — partial info
                pointing toward the target (e.g., digit is in the target
                but at an unknown slot, or your slot is within 2 of the
                target).
              </li>
              <li>
                <span className="text-bad">Cold</span> — ruled-out info
                (e.g., digit doesn&apos;t appear, or your guess is too
                high/low at that slot).
              </li>
              <li>
                <span className="text-muted">Idle</span> — no info at
                that slot from the chosen clue.
              </li>
            </ul>
            <p>
              The exact meaning depends on the clue — check the legend on
              each clue&apos;s reference card below for the per-color
              rules.
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
              You can spend a lock to{" "}
              <strong className="text-foreground">redraw</strong> the
              offered clue pair (tap the button again to redraw multiple
              times), or pick{" "}
              <strong className="text-foreground">Clue Reuse</strong>{" "}
              (costs 1 🔒) to repeat a previously-used clue.
            </p>
            <p>
              Some clues — marked with{" "}
              <span className="text-good">+🔒</span> in the chooser —
              grant +1 lock when chosen, so you can stockpile a budget for
              redraws or Clue Reuse later. There&apos;s no cap on locks.
            </p>
            <p>
              Hard Unlimited starts with zero locks — you can still earn
              them via bonus-lock clues during the game.
            </p>
          </Accordion>

          <Accordion
            title="Settings"
            isOpen={openSection === "settings"}
            onToggle={() => toggleSection("settings")}
          >
            <p>
              Open via the gear (⚙︎) icon in the top bar. Daily uses fixed
              settings; the rest apply to Unlimited.
            </p>
            <ul className="list-disc list-outside pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Number length</strong>{" "}
                (Unlimited only) — 5- or 6-digit puzzles. Same 7-turn
                budget either way.
              </li>
              <li>
                <strong className="text-foreground">Difficulty</strong> —
                Normal starts you with 1 lock and guarantees a friendly
                turn-1 clue. Hard starts with 0 locks, no curated opener,
                and removes Clue Reuse from the deck.
              </li>
              <li>
                <strong className="text-foreground">Clue selection</strong>{" "}
                — Manual offers two clues each round to pick from. Auto
                pre-deals one clue per upcoming guess up-front (no
                chooser, no redraws, no Clue Reuse).
              </li>
              <li>
                <strong className="text-foreground">Color blind palette</strong>{" "}
                — Swaps the warm/cold colors to blue/orange so cell
                states stay distinguishable with common forms of color
                vision deficiency.
              </li>
              <li>
                <strong className="text-foreground">Clue descriptions</strong>{" "}
                — Toggles the chooser&apos;s description text. Off gives
                a compact chooser once you&apos;ve learned the clues; the
                full reference here always shows them.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">Clear local data</strong>{" "}
              wipes your in-progress games, personal stats, daily history,
              and settings on this device. Global daily stats on the
              server are unaffected.
            </p>
          </Accordion>

          <Accordion
            title="Stats & achievements"
            isOpen={openSection === "stats"}
            onToggle={() => toggleSection("stats")}
          >
            <p>
              Personal stats track wins, win rate, average turns, and
              current/best streaks — broken out by digit length,
              difficulty, and clue mode in Unlimited.
            </p>
            <p>
              Achievements unlock as you play; some give silver for a
              first-tier feat and gold for a tougher second tier, others
              award silver for any prong and gold for clearing every
              prong. Tap a trophy&apos;s info button for details.
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
              Save Clue Reuse for clues whose result depends on the guess
              (Higher or Lower, Oracle, Thermometer) — re-running them
              against a sharper guess pulls more new info than re-running
              a guess-independent clue.
            </p>
            <p>
              Track locks as a budget, not just a safety net: stockpiling
              via bonus-lock clues opens up multi-redraw turns and lets
              you chain Clue Reuse picks in the late game.
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
                      <ClueLockBadge clueId={clue.id} size="xs" />
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
                      hideCurationStar
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
