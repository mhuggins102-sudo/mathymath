"use client";

import type { ReactNode } from "react";

/**
 * Bottom-of-play resource panel shared by unlimited and daily modes.
 * Left column shows the player's current lock balance; right column
 * is contextual helper text or a Redraw control. `advancedMode` is
 * accepted so callers can pass through the flag for future per-mode
 * differentiation, but currently only the lock balance varies (the
 * positional-cap counter that used to live here was removed when
 * the cap mechanic was retired).
 */
export function ResourceBalance({
  lockBalance,
  advancedMode: _advancedMode,
  hint,
}: {
  lockBalance: number;
  advancedMode?: boolean;
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
      </div>
      {hint ? (
        <div className="text-[10px] text-muted text-right leading-snug flex-1 min-w-0">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
