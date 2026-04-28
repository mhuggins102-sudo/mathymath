"use client";

import type { ReactNode } from "react";

/**
 * Bottom-of-play resource panel shared by unlimited and daily modes.
 * Two slots:
 *   - Left column: the player's current balance, stacked. Lock row
 *     always renders so there's a stable place to glance for the
 *     resource. Positional row only renders when `advancedMode` is on
 *     (and stays at 0x once the cap is hit, rather than disappearing
 *     — keeps the layout from jumping). Daily mode passes
 *     `advancedMode={false}` so the positional row never shows.
 *   - Right column: contextual helper text, the Redraw control during
 *     the chooser phase, etc. Accepts ReactNode so callers can stack
 *     two-line layouts via block spans or render a button.
 *
 * `px-2` adds a small horizontal buffer so the balance and helper text
 * sit a hair off the page edges. `min-h-10` keeps the keypad from
 * shifting up/down as the helper text grows from 0 → 1 → 2 lines.
 */
export function ResourceBalance({
  lockBalance,
  advancedMode,
  positionalRemaining,
  hint,
}: {
  lockBalance: number;
  advancedMode: boolean;
  positionalRemaining: number;
  hint?: ReactNode;
}) {
  return (
    <div className="mt-2 px-2 flex items-start justify-between gap-3 min-h-10">
      <div className="flex flex-col items-start gap-1 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-muted leading-none">
          <span aria-label={`${lockBalance} locks remaining`}>
            {lockBalance}x
          </span>
          <span aria-hidden="true">🔒</span>
        </span>
        {advancedMode && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-muted leading-none">
            <span
              aria-label={`${positionalRemaining} positional clues remaining`}
            >
              {positionalRemaining}x
            </span>
            <span
              className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent"
              aria-hidden="true"
            >
              positional
            </span>
          </span>
        )}
      </div>
      {hint ? (
        <div className="text-[10px] text-muted text-right leading-snug flex-1 min-w-0">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
