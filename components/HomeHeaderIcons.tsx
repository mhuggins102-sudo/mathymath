"use client";

import { useState } from "react";
import { HelpModal } from "./HelpModal";
import { SettingsDrawer } from "./SettingsDrawer";
import { LifetimeStatsModal } from "./LifetimeStatsModal";
import { GearIcon } from "./GearIcon";

/**
 * Top-right icon cluster on the home screen: settings, lifetime stats,
 * help. Mirrors the placement used inside the game pages so it feels
 * consistent: the cluster aligns with the right edge of the centered
 * `max-w-md` content column, not the viewport edge — on a wide laptop
 * monitor the icons would otherwise float far off to the right of the
 * actual content.
 */
export function HomeHeaderIcons() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // 44×44 tap targets (Apple HIG / WCAG 2.5.5 minimum). The cluster of
  // three lives in an empty corner so the extra size costs no layout.
  const btn =
    "inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-foreground active:bg-surface-2 transition text-base";

  return (
    <>
      {/* Centered + right-aligned wrapper so the cluster sits at the
          right edge of the max-w-md content column on every viewport,
          matching the in-game pages' header placement. The wrapper is
          itself top-pinned so the icons don't push the home content
          down. `pointer-events-none` on the wrapper + `auto` on the
          inner cluster keeps clicks from being blocked behind the
          empty padding zones. */}
      <div className="fixed top-3 inset-x-0 z-20 px-3 pointer-events-none">
        <div className="max-w-md mx-auto flex justify-end pointer-events-auto">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={btn}
              aria-label="Settings"
            >
              <GearIcon />
            </button>
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className={btn}
              aria-label="Lifetime stats"
            >
              📊
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className={`${btn} text-lg font-semibold`}
              aria-label="Help"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LifetimeStatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
