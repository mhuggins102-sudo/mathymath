"use client";

import { useEffect, useState } from "react";
import {
  dailyHistoryStats,
  loadDailyHistory,
  loadUnlimitedStats,
  type DailyHistoryStats,
  type PersonalStats,
} from "@/lib/persistence/localStore";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";

export type StatsMode = "daily" | "unlimited" | "both";

interface LifetimeStatsModalProps {
  open: boolean;
  onClose: () => void;
  /** "both" (default): shows Daily + Unlimited.
   *  "daily" / "unlimited": shows only that mode's chart, popup-style. */
  mode?: StatsMode;
}

export function LifetimeStatsModal({
  open,
  onClose,
  mode = "both",
}: LifetimeStatsModalProps) {
  const [daily, setDaily] = useState<DailyHistoryStats | null>(null);
  const [unlimited, setUnlimited] = useState<PersonalStats | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode !== "unlimited") setDaily(dailyHistoryStats(loadDailyHistory()));
    if (mode !== "daily") setUnlimited(loadUnlimitedStats());
  }, [open, mode]);

  if (!open) return null;

  const title =
    mode === "daily"
      ? "Daily stats"
      : mode === "unlimited"
      ? "Unlimited stats"
      : "Lifetime stats";

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          type="button"
          className="text-muted hover:text-foreground text-sm px-2 py-1"
          onClick={onClose}
        >
          Close ✕
        </button>
      </div>
      <div className="space-y-4">
        {(mode === "daily" || mode === "both") && (
          <Block
            title="Daily"
            showTitle={mode === "both"}
            played={daily?.played ?? 0}
            wins={daily?.wins ?? 0}
            currentStreak={daily?.currentStreak ?? 0}
            bestStreak={daily?.bestStreak ?? 0}
            distribution={daily?.distribution ?? {}}
          />
        )}
        {(mode === "unlimited" || mode === "both") && (
          <Block
            title="Unlimited"
            showTitle={mode === "both"}
            played={unlimited?.played ?? 0}
            wins={unlimited?.wins ?? 0}
            currentStreak={unlimited?.currentStreak ?? 0}
            bestStreak={unlimited?.bestStreak ?? 0}
            distribution={unlimited?.distribution ?? {}}
          />
        )}
      </div>
    </>
  );

  // Home ("both") uses the full-screen modal aesthetic shared with Help
  // and Settings. In-game ("daily" / "unlimited") uses a centered card
  // popup that closes on backdrop tap.
  if (mode === "both") {
    return (
      <div
        className="fixed inset-0 z-50 bg-background overflow-y-auto text-left"
        role="dialog"
        aria-modal="true"
      >
        <div className="max-w-md mx-auto p-4 pb-20">{content}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 text-left"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface rounded-xl border border-border shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}

function meanFromDistribution(distribution: Record<string, number>): number | null {
  let sum = 0;
  let n = 0;
  for (const [k, count] of Object.entries(distribution)) {
    const g = Number(k);
    if (!Number.isFinite(g)) continue;
    sum += g * count;
    n += count;
  }
  return n === 0 ? null : sum / n;
}

function Block({
  title,
  showTitle,
  played,
  wins,
  currentStreak,
  bestStreak,
  distribution,
}: {
  title: string;
  showTitle: boolean;
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  distribution: Record<string, number>;
}) {
  const winPct = played ? Math.round((wins / played) * 100) : 0;
  const meanVal = meanFromDistribution(distribution);
  const meanLabel = meanVal === null ? "—" : meanVal.toFixed(1);

  return (
    <div className="bg-surface-2 rounded-lg border border-border p-3">
      {showTitle && (
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">
          {title}
        </h3>
      )}
      {played === 0 ? (
        <p className="text-xs text-muted">
          No games played yet. Your stats will appear here once you finish one.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-1 mb-3">
            <Stat label="Played" value={played} />
            <Stat label="Win %" value={winPct} />
            <Stat label="Mean" value={meanLabel} hint="wins only" />
            <Stat label="Streak" value={currentStreak} />
            <Stat label="Best" value={bestStreak} />
          </div>
          <DistributionBars
            distribution={distribution}
            maxGuesses={DEFAULT_MAX_GUESSES}
          />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="text-center">
      <div className="font-mono text-lg leading-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted leading-tight">
        {label}
      </div>
      {hint && (
        <div className="text-[8px] text-muted/70 leading-tight">{hint}</div>
      )}
    </div>
  );
}

function DistributionBars({
  distribution,
  maxGuesses,
}: {
  distribution: Record<string, number>;
  maxGuesses: number;
}) {
  const values = Object.values(distribution);
  const max = Math.max(1, ...values);
  return (
    <div className="space-y-1">
      {Array.from({ length: maxGuesses }, (_, i) => i + 1).map((n) => {
        const count = distribution[String(n)] ?? 0;
        const pct = count === 0 ? 0 : (count / max) * 100;
        return (
          <div key={n} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-muted font-mono">{n}</span>
            <div className="flex-1 bg-surface rounded overflow-hidden h-5 relative">
              <div
                className="bg-accent/60 h-full flex items-center justify-end px-2 text-[10px] font-mono text-background"
                style={{ width: `${Math.max(pct, count ? 12 : 0)}%` }}
              >
                {count || ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
