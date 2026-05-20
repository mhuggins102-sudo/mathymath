"use client";

import { useEffect } from "react";
import {
  dismissCurrentToast,
  useAchievementToastQueue,
} from "@/lib/hooks/useAchievementToasts";
import { ACHIEVEMENTS } from "@/lib/achievements/registry";
import { TrophyIcon } from "./TrophyIcon";

const TOAST_DISPLAY_MS = 4000;

/** Global toast host. Mount once at the app shell. Renders the head of
 *  the toast queue with a slide-in card; auto-dismisses after a few
 *  seconds, advancing the queue. Tap or Escape dismisses the current
 *  toast immediately. */
export function AchievementToastHost() {
  const queue = useAchievementToastQueue();
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(dismissCurrentToast, TOAST_DISPLAY_MS);
    return () => window.clearTimeout(t);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissCurrentToast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;
  const ach = ACHIEVEMENTS.find((a) => a.id === current.id);
  if (!ach) return null;
  // Tier rendering: achievements with two unlock slots (level1+level2
  // OR criteria) award silver on first unlock and gold on the second.
  // Single-level achievements jump straight to gold on their only
  // unlock. Criteria-based achievements live in the two-tier branch
  // because the criteria array IS what makes them two-tier.
  const hasTwoTiers = !!ach.criteria || !!ach.level2;
  const tier =
    current.level === 2 ? "gold" : hasTwoTiers ? "silver" : "gold";
  const tierHeader = hasTwoTiers
    ? `Achievement unlocked · ${current.level === 2 ? "Gold" : "Silver"}`
    : "Achievement unlocked";
  // For level-style achievements, prefer the matching level's label.
  // For criteria-based achievements (no level1/level2), fall back to
  // the achievement's `description` so the toast still describes what
  // the player just earned.
  const label =
    current.level === 2
      ? ach.level2?.label ?? ach.description
      : ach.level1?.label ?? ach.description;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none px-3 w-full max-w-md"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={dismissCurrentToast}
        className="pointer-events-auto w-full text-left bg-surface border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 toast-enter"
        aria-label="Dismiss achievement notification"
      >
        <TrophyIcon tier={tier} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted">
            {tierHeader}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {ach.name}
          </p>
          {label && (
            <p className="text-xs text-muted leading-snug">{label}</p>
          )}
        </div>
      </button>
    </div>
  );
}
