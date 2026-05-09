"use client";

import { z } from "zod";

const settingsSchema = z.object({
  version: z.literal(1),
  /** Unlimited-mode Hard difficulty (player-facing label "Hard";
   *  internal storage key kept as `advancedMode` so legacy saves
   *  parse cleanly without a migration). Hard rules: full deck
   *  shuffle (no curated round-1 guarantee), start with 0 locks,
   *  and Clue Reuse is removed. Daily play is unaffected — the
   *  daily puzzle always uses Normal so leaderboards stay
   *  comparable. */
  advancedMode: z.boolean().default(false),
  /** Unlimited-mode Auto clue selection (player-facing label "Auto";
   *  internal key kept as `preselectedClues`). The game deals 6
   *  clues up-front, one per guess. The chooser, redraw, and Clue
   *  Reuse are disabled; locks pin a digit only. When advancedMode
   *  (Hard) is also on, the deck shuffles freely with no curated
   *  turn-1 guarantee. */
  preselectedClues: z.boolean().default(false),
  colorblind: z.boolean().default(false),
  /** When false, clue cards in the in-game chooser collapse to just
   *  the name + lock cost + legend + curated star. The Help modal
   *  always shows descriptions regardless. Default true so new
   *  players keep the on-screen guide. */
  showClueDescriptions: z.boolean().default(true),
});

export type Settings = z.infer<typeof settingsSchema>;

const KEY = "mathymath:settings";

export function defaultSettings(): Settings {
  return {
    version: 1,
    advancedMode: false,
    preselectedClues: false,
    colorblind: false,
    showClueDescriptions: true,
  };
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings();
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return defaultSettings();
  try {
    // zod strips unknown keys by default, so legacy saves carrying a
    // retired `haptics` field still parse cleanly into the new shape.
    return settingsSchema.parse(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

/** Apply current settings to the document root (idempotent, safe on each render). */
export function applySettings(s: Settings): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("colorblind", s.colorblind);
}
