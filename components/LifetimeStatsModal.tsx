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
import { Modal } from "./Modal";

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

  const title =
    mode === "daily"
      ? "Daily stats"
      : mode === "unlimited"
      ? "Unlimited stats"
      : "Lifetime stats";

  const titleId = `stats-title-${mode}`;

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <button
          type="button"
          className="inline-flex items-center justify-center min-h-11 px-3 rounded-md text-muted hover:text-foreground active:bg-surface-2 text-sm"
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
      <Modal open={open} onClose={onClose} titleId={titleId} variant="full">
        <div className="max-w-md mx-auto p-4 pb-20">{content}</div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} titleId={titleId} variant="overlay">
      <div className="bg-surface rounded-xl border border-border shadow-2xl p-4">
        {content}
      </div>
    </Modal>
  );
}

function meanFromDistribution(
  distribution: Record<string, number>,
  losses: number,
): number | null {
  let sum = 0;
  let n = 0;
  for (const [k, count] of Object.entries(distribution)) {
    const g = Number(k);
    if (!Number.isFinite(g)) continue;
    sum += g * count;
    n += count;
  }
  // Losses count as one more than the max budget (8 for a 7-guess game)
  // so the mean reflects overall skill, not just winning speed.
  sum += losses * (DEFAULT_MAX_GUESSES + 1);
  n += losses;
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
  const losses = Math.max(0, played - wins);
  const meanVal = meanFromDistribution(distribution, losses);
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
            <Stat label="Mean" value={meanLabel} />
            <Stat label="Streak" value={currentStreak} />
            <Stat label="Best" value={bestStreak} />
          </div>
          <DistributionBars
            distribution={distribution}
            maxGuesses={DEFAULT_MAX_GUESSES}
            losses={Math.max(0, played - wins)}
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
  losses,
}: {
  distribution: Record<string, number>;
  maxGuesses: number;
  losses: number;
}) {
  const values = Object.values(distribution);
  // Include DNFs in the max so the losses bar shares the same scale.
  const max = Math.max(1, ...values, losses);
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
      {/* DNF row: games ended without a solve (ran out of guesses). */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className="w-4 text-muted font-mono"
          aria-label="did not finish"
          title="Did not finish"
        >
          ✕
        </span>
        <div className="flex-1 bg-surface rounded overflow-hidden h-5 relative">
          <div
            className="bg-bad/60 h-full flex items-center justify-end px-2 text-[10px] font-mono text-background"
            style={{
              width: `${
                losses === 0 ? 0 : Math.max((losses / max) * 100, 12)
              }%`,
            }}
          >
            {losses || ""}
          </div>
        </div>
      </div>
    </div>
  );
}
