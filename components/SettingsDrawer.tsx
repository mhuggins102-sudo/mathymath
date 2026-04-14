"use client";

import { useCallback } from "react";
import { useSettings } from "@/lib/hooks/useSettings";
import { clearAllLocalData } from "@/lib/persistence/localStore";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { settings, setSetting } = useSettings();

  const handleReset = useCallback(() => {
    const ok = window.confirm(
      "Clear all local game data? This wipes your in-progress games, personal stats, daily history, and settings on this device. Global stats are unaffected.",
    );
    if (!ok) return;
    clearAllLocalData();
    window.location.reload();
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 text-left"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-md mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            type="button"
            className="text-muted hover:text-foreground text-sm px-2 py-1"
            onClick={onClose}
          >
            Close ✕
          </button>
        </div>

        <div className="space-y-1">
          <Toggle
            label="Colorblind palette"
            description="Use blue/orange instead of red/green so positional clue colors are distinguishable with common forms of color vision deficiency."
            value={settings.colorblind}
            onChange={(v) => setSetting("colorblind", v)}
          />
          <Toggle
            label="Haptics"
            description="Short vibration on guess submit, clue reveal, and win. No-op on devices without vibration support."
            value={settings.haptics}
            onChange={(v) => setSetting("haptics", v)}
          />
        </div>

        <div className="mt-8 pt-4 border-t border-border">
          <h3 className="text-xs uppercase tracking-wider text-muted mb-2">
            Data
          </h3>
          <button
            type="button"
            onClick={handleReset}
            className="w-full bg-bad/10 text-bad border border-bad/30 rounded-lg py-2 text-sm font-semibold active:scale-95"
          >
            Clear local data
          </button>
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            In-progress games, personal stats, daily history, and settings on
            this device are wiped. Global daily stats on the server are not
            affected.
          </p>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-3 border-b border-border/50 last:border-0 cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
          value ? "bg-accent" : "bg-surface-2 border border-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
    </label>
  );
}
