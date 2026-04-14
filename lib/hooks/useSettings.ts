"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applySettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  type Settings,
} from "@/lib/settings";

/**
 * Hook that loads, applies, and lets you mutate user settings. Persists to
 * localStorage and toggles the <html class="colorblind"> class.
 */
export function useSettings(): {
  settings: Settings;
  hydrated: boolean;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
} {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applySettings(loaded);
    setHydrated(true);
  }, []);

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((cur) => {
        const next = { ...cur, [key]: value };
        saveSettings(next);
        applySettings(next);
        return next;
      });
    },
    [],
  );

  return { settings, hydrated, setSetting };
}
