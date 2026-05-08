"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/hooks/useSettings";
import {
  clearAllLocalData,
  loadUnlimitedMode,
  saveUnlimitedMode,
  type UnlimitedMode,
} from "@/lib/persistence/localStore";
import { Modal } from "./Modal";

export type SettingsContext = "home" | "unlimited" | "daily";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Where the drawer was opened from. Drives which toggles are
   *  interactive: "daily" disables every Unlimited-only toggle since
   *  the daily puzzle uses fixed rules. */
  context?: SettingsContext;
  /** Optional hook the Unlimited page passes so toggling the digit
   *  mode (5 ↔ 6) restarts the in-progress game in the new mode.
   *  Other contexts (home, daily) leave it unset; the change is
   *  persisted but only takes effect on the next new game. */
  onDigitModeChange?: (mode: UnlimitedMode) => void;
}

export function SettingsDrawer({
  open,
  onClose,
  context = "home",
  onDigitModeChange,
}: SettingsDrawerProps) {
  const { settings, setSetting } = useSettings();
  const [digitMode, setDigitMode] = useState<UnlimitedMode>("5");

  // Hydrate digit mode from localStorage once the drawer can read window.
  // Re-hydrate on each open so changes from another tab show up too.
  useEffect(() => {
    if (open) setDigitMode(loadUnlimitedMode());
  }, [open]);

  const handleDigitMode = useCallback(
    (next: UnlimitedMode) => {
      setDigitMode(next);
      saveUnlimitedMode(next);
      onDigitModeChange?.(next);
    },
    [onDigitModeChange],
  );

  const handleReset = useCallback(() => {
    const ok = window.confirm(
      "Clear all local game data? This wipes your in-progress games, personal stats, daily history, and settings on this device. Global stats are unaffected.",
    );
    if (!ok) return;
    clearAllLocalData();
    window.location.reload();
  }, []);

  const unlimitedDisabled = context === "daily";

  return (
    <Modal open={open} onClose={onClose} titleId="settings-title" variant="full">
      <div className="max-w-md mx-auto p-5 pb-24">
        <div className="flex justify-between items-center mb-6">
          <h2 id="settings-title" className="text-xl font-semibold tracking-tight">
            Settings
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-center min-h-11 px-3 rounded-md text-muted hover:text-foreground active:bg-surface-2 text-sm"
            onClick={onClose}
          >
            Close ✕
          </button>
        </div>

        <section className="bg-surface-2/50 rounded-xl border border-border divide-y divide-border/50">
          <BinaryRow
            label="Game length"
            optionA={{ value: "5", text: "5-digit" }}
            optionB={{ value: "6", text: "6-digit" }}
            value={digitMode}
            onChange={handleDigitMode}
            disabled={unlimitedDisabled}
            disabledHint={unlimitedDisabled ? "Daily is always 5-digit." : undefined}
            info="Unlimited mode only. Choose 5- or 6-digit puzzles for new games."
          />
          <BinaryRow
            label="Clue style"
            optionA={{ value: "traditional", text: "Traditional" }}
            optionB={{ value: "advanced", text: "Advanced" }}
            value={settings.advancedMode ? "advanced" : "traditional"}
            onChange={(v) => setSetting("advancedMode", v === "advanced")}
            disabled={unlimitedDisabled}
            disabledHint={unlimitedDisabled ? "Daily uses Traditional rules." : undefined}
            info="Traditional: pair 1 always includes a curated round-1 clue (Digit Overlap, Elimination, Odd or Even, Contains Digit, Higher or Lower, Within 2, Oracle, or Thermometer); start with 1 lock. Advanced: full deck shuffle (no curated turn-1 guarantee), start with 0 locks, and Clue Reuse is removed."
          />
          <BinaryRow
            label="Clue selection"
            optionA={{ value: "user", text: "User Selected" }}
            optionB={{ value: "preselected", text: "Preselected" }}
            value={settings.preselectedClues ? "preselected" : "user"}
            onChange={(v) => setSetting("preselectedClues", v === "preselected")}
            disabled={unlimitedDisabled}
            disabledHint={unlimitedDisabled ? "Daily uses User Selected." : undefined}
            info="User Selected: choose between two clues every round (the standard mode). Preselected: the full deck is dealt up-front, one clue per upcoming guess; the chooser, redraw, and Clue Reuse are disabled."
          />
          <ToggleRow
            label="Color blind palette"
            value={settings.colorblind}
            onChange={(v) => setSetting("colorblind", v)}
            info="Use blue/orange instead of red/green so the cell-state colors are distinguishable with common forms of color vision deficiency."
          />
          <ToggleRow
            label="Clue descriptions"
            value={settings.showClueDescriptions}
            onChange={(v) => setSetting("showClueDescriptions", v)}
            info="When on, each clue card in the chooser includes its plain-language description. Turn off for a compact chooser once you've memorized the clues — the Help screen always shows full descriptions."
          />
        </section>

        <div className="mt-8 pt-4 border-t border-border">
          <h3 className="text-xs uppercase tracking-wider text-muted mb-2">
            Data
          </h3>
          <button
            type="button"
            onClick={handleReset}
            className="w-full bg-bad/10 text-bad border border-bad/30 rounded-lg py-2.5 text-sm font-semibold active:scale-[0.99]"
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
    </Modal>
  );
}

/** Two-state binary toggle row: label on the left, segmented A/B
 *  control on the right, optional (i) info popover. Used for the
 *  enum-style settings (5/6-digit, Traditional/Advanced,
 *  User/Preselected). */
function BinaryRow<T extends string>({
  label,
  optionA,
  optionB,
  value,
  onChange,
  info,
  disabled,
  disabledHint,
}: {
  label: string;
  optionA: { value: T; text: string };
  optionB: { value: T; text: string };
  value: T;
  onChange: (v: T) => void;
  info: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0 inline-flex items-center gap-1.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <InfoPopover label={`Info about ${label}`} body={info} disabledHint={disabledHint} />
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-1 bg-surface rounded-md p-0.5 text-[11px] font-semibold shrink-0"
      >
        {[optionA, optionB].map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded transition ${
                selected
                  ? "bg-accent/80 text-background"
                  : "text-muted hover:text-foreground"
              } ${disabled ? "cursor-not-allowed" : ""}`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Boolean on/off toggle row with the same layout as BinaryRow. */
function ToggleRow({
  label,
  value,
  onChange,
  info,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  info: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0 inline-flex items-center gap-1.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <InfoPopover label={`Info about ${label}`} body={info} />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
          value ? "bg-accent" : "bg-surface border border-border"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

/** Small "(i)" button that opens a tooltip-style popover with the
 *  setting's longer description. Closes on outside click or escape. */
function InfoPopover({
  label,
  body,
  disabledHint,
}: {
  label: string;
  body: string;
  disabledHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted/50 text-[10px] font-bold text-muted hover:text-foreground hover:border-foreground/60 leading-none"
      >
        i
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-30 w-64 max-w-[calc(100vw-2rem)] bg-surface-2 border border-border rounded-lg shadow-lg p-3 text-[11px] text-muted leading-relaxed">
          <p>{body}</p>
          {disabledHint && (
            <p className="mt-1 italic text-foreground/70">{disabledHint}</p>
          )}
        </div>
      )}
    </div>
  );
}
