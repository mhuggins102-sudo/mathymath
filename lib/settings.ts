"use client";

import { z } from "zod";

const settingsSchema = z.object({
  version: z.literal(1),
  /** Unlimited-mode "Advanced" rules: at most 2 positional clues across
   *  the game, with the deck shuffled freely (no pair-1 category
   *  guarantees). Once the cap is reached, the chooser stops offering
   *  positional cards and Clue Reuse is restricted to previously-used
   *  non-positional clues. Daily play is unaffected — the daily puzzle
   *  always uses the standard ruleset so leaderboards stay comparable. */
  advancedMode: z.boolean().default(false),
  /** Unlimited-mode "Preselected Clues" mode: the game deals 6 clues
   *  up-front, one per guess. The clue chooser, redraw, and Clue Reuse
   *  are disabled; locks are only used to pin a digit. When advancedMode
   *  is also on, the deck follows advanced rules (≤ 2 positional, no
   *  positional guarantee on turn 1). When off, the deck guarantees a
   *  positional clue on turn 1 and the rest are random non-special. */
  preselectedClues: z.boolean().default(false),
  colorblind: z.boolean().default(false),
});

export type Settings = z.infer<typeof settingsSchema>;

const KEY = "mathymath:settings";

export function defaultSettings(): Settings {
  return {
    version: 1,
    advancedMode: false,
    preselectedClues: false,
    colorblind: false,
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
