"use client";

import { useEffect } from "react";
import { applySettings, loadSettings } from "@/lib/settings";

/**
 * Applies saved settings to <html> on first client render so the colorblind
 * palette takes effect before the user interacts with the settings drawer.
 */
export function SettingsHydrator() {
  useEffect(() => {
    applySettings(loadSettings());
  }, []);
  return null;
}
