"use client";

import { useState } from "react";
import { AchievementsModal } from "./AchievementsModal";
import { HelpModal } from "./HelpModal";
import { LifetimeStatsModal } from "./LifetimeStatsModal";

/**
 * Top-right icon cluster on the home screen: achievements, lifetime
 * stats, and help. The settings button moved off this cluster and onto
 * the home screen next to the Unlimited button (since most settings
 * are Unlimited-specific anyway). The cluster aligns with the right
 * edge of the centered `max-w-md` content column.
 */
export function HomeHeaderIcons() {
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const btn =
    "inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-foreground active:bg-surface-2 transition text-base";

  return (
    <>
      <div className="fixed top-3 inset-x-0 z-20 px-3 pointer-events-none">
        <div className="max-w-md mx-auto flex justify-end pointer-events-auto">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setAchievementsOpen(true)}
              className={btn}
              aria-label="Achievements"
            >
              🏆
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

      <AchievementsModal
        open={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
      />
      <LifetimeStatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
