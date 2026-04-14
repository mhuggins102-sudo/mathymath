"use client";

import { z } from "zod";

const settingsSchema = z.object({
  version: z.literal(1),
  colorblind: z.boolean().default(false),
  haptics: z.boolean().default(true),
});

export type Settings = z.infer<typeof settingsSchema>;

const KEY = "mathymath:settings";

export function defaultSettings(): Settings {
  return { version: 1, colorblind: false, haptics: true };
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings();
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return defaultSettings();
  try {
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

/** Fires a short vibration when the user has haptics enabled. Cheap to call. */
export function buzz(ms = 15): void {
  if (typeof window === "undefined") return;
  const s = loadSettings();
  if (!s.haptics) return;
  const n = navigator as Navigator & { vibrate?: (ms: number) => boolean };
  try {
    n.vibrate?.(ms);
  } catch {
    // ignore
  }
}
