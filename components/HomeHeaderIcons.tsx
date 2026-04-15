"use client";

import { useState } from "react";
import { HelpModal } from "./HelpModal";
import { SettingsDrawer } from "./SettingsDrawer";
import { LifetimeStatsModal } from "./LifetimeStatsModal";

/**
 * Top-right icon cluster on the home screen: settings, lifetime stats,
 * help. Mirrors the placement used inside the game pages so it feels
 * consistent.
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
      <div className="fixed top-2 right-2 z-20 flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className={btn}
          aria-label="Settings"
        >
          ⚙
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

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LifetimeStatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
