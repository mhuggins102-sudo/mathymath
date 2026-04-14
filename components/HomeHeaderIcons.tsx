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

  const btn =
    "text-muted hover:text-foreground px-2 py-1 transition text-base";

  return (
    <>
      <div className="fixed top-3 right-3 z-20 flex items-center gap-1">
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
          className={`${btn} text-sm`}
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
