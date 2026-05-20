"use client";

import { memo } from "react";
import type { Clue, ClueId } from "@/lib/game/clues/types";
import { CLUE_REUSE_CLUE_ID, CLUE_REUSE_COST } from "@/lib/game/locks";
import { ROUND1_CURATED_CLUE_IDS } from "@/lib/game/clueSelector";
import { useSettings } from "@/lib/hooks/useSettings";
import { ClueLegend } from "./ClueLegend";
import { ClueLockBadge } from "./ClueLockBadge";

interface ClueChooserProps {
  options: [Clue, Clue];
  onChoose: (id: ClueId) => void;
  /** When provided, a "Redraw" button appears below the cards. */
  onRedraw?: () => void;
  canRedraw?: boolean;
  /** Locks the player has remaining when the chooser appears. Used to
   *  gate Clue Reuse (which costs a lock) so the player can't pick it
   *  with an empty budget. Optional — falls back to "always allowed"
   *  for callers that don't track locks. */
  locksAvailable?: number;
}

/**
 * Inline clue picker rendered in place of the keypad after a guess is
 * submitted. Stacked vertically (full width) so each clue's description
 * can render on multiple lines without truncation.
 */
function ClueChooserImpl({
  options,
  onChoose,
  onRedraw,
  canRedraw,
  locksAvailable,
}: ClueChooserProps) {
  const { settings, hydrated } = useSettings();
  // Don't render the description block until useSettings has read
  // localStorage. With showClueDescriptions defaulting to `true`, the
  // initial (pre-hydration) render would flash the full card before
  // collapsing to the compact form on the next tick. Gating on
  // hydrated trades that for a tiny appear-after-hydrate flash for
  // users who keep descriptions ON, which is far less jarring.
  const showDescriptions = hydrated && settings.showClueDescriptions;
  return (
    <div className="w-full max-w-md mx-auto select-none">
      <p className="text-center text-[10px] uppercase tracking-wider text-muted mb-2">
        Pick a clue
      </p>
      <div className="flex flex-col gap-2">
        {options.map((clue) => {
          // Clue Reuse is gated on lock budget — it costs one lock to
          // pick, so an empty budget makes the card unselectable.
          const isClueReuse = clue.id === CLUE_REUSE_CLUE_ID;
          const lockUnaffordable =
            isClueReuse &&
            locksAvailable !== undefined &&
            locksAvailable < CLUE_REUSE_COST;
          const disabled = lockUnaffordable;
          // Curated round-1 clues are flagged with a star EVERY time
          // they appear in the chooser (not just on round 1) so the
          // visual cue is consistent and the player can learn which
          // clues are designed as friendly openers — useful info even
          // when picking them on later rounds.
          const showStar = ROUND1_CURATED_CLUE_IDS.has(clue.id);
          return (
            <button
              key={clue.id}
              type="button"
              onClick={() => onChoose(clue.id)}
              disabled={disabled}
              className="w-full text-left bg-surface-2 hover:bg-surface-2/80 active:scale-[0.99] transition rounded-lg px-4 py-3 border border-border disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-semibold text-foreground inline-flex items-center gap-1.5">
                  {clue.name}
                  {/* Lock-economy badge: green +🔒 for bonus-lock clues,
                      red −🔒 for Clue Reuse. Sits next to the name so
                      the player can read the trade-off at a glance. */}
                  <ClueLockBadge clueId={clue.id} />
                </span>
                {showStar && (
                  <span
                    className="text-warn text-sm shrink-0"
                    title="Curated turn-1 clue"
                    aria-label="Curated turn-1 clue"
                  >
                    ⭐
                  </span>
                )}
              </div>
              {showDescriptions && (
                <p className="text-xs text-muted leading-relaxed">
                  {clue.description}
                </p>
              )}
              {lockUnaffordable && (
                <p className="text-[10px] text-bad mt-1">
                  Not enough locks remaining.
                </p>
              )}
              {clue.legend && <ClueLegend entries={clue.legend} />}
            </button>
          );
        })}
      </div>
      {onRedraw && canRedraw && (
        <button
          type="button"
          onClick={onRedraw}
          className="w-full mt-3 text-xs text-muted hover:text-foreground py-1 text-right"
        >
          Redraw (costs 🔒×1)
        </button>
      )}
    </div>
  );
}

/**
 * Memoized to skip re-renders when the parent re-renders for unrelated
 * state (typed input, lock pending). The two prop changes that should
 * trigger a re-render — the offered pair flipping and the locks budget
 * crossing the Clue Reuse threshold — both come through as primitive /
 * tuple reference changes that React.memo's default shallow compare
 * catches. Mobile chooser-phase lag was tracing back to this component
 * iterating its options list on every keystroke.
 */
export const ClueChooser = memo(ClueChooserImpl);
