"use client";

import type { LegendEntry } from "@/lib/game/clues/types";

/** Maps clue-legend state names to background classes that use the active
 *  color scheme via CSS vars. Toggling html.colorblind instantly swaps. */
const SWATCH_CLASS: Record<LegendEntry["state"], string> = {
  idle: "bg-border",
  entering: "bg-accent/40",
  match: "bg-good",
  close: "bg-close",
  warm: "bg-warn",
  cool: "bg-cool",
  cold: "bg-bad",
  hint: "bg-warn/50",
};

export function ClueLegend({ entries }: { entries: LegendEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted mt-1">
      {entries.map((e, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-sm ${SWATCH_CLASS[e.state]}`}
            aria-hidden
          />
          {e.label}
        </span>
      ))}
    </div>
  );
}
