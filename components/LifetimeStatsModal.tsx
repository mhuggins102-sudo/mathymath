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

interface LifetimeStatsModalProps {
  open: boolean;
  onClose: () => void;
}

export function LifetimeStatsModal({ open, onClose }: LifetimeStatsModalProps) {
  const [daily, setDaily] = useState<DailyHistoryStats | null>(null);
  const [unlimited, setUnlimited] = useState<PersonalStats | null>(null);

  useEffect(() => {
    if (!open) return;
    setDaily(dailyHistoryStats(loadDailyHistory()));
    setUnlimited(loadUnlimitedStats());
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Lifetime stats"
    >
      <div className="max-w-md mx-auto p-4 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Lifetime stats</h2>
          <button
            type="button"
            className="text-muted hover:text-foreground text-sm px-2 py-1"
            onClick={onClose}
          >
            Close ✕
          </button>
        </div>

        <Block
          title="Daily"
          played={daily?.played ?? 0}
          wins={daily?.wins ?? 0}
          currentStreak={daily?.currentStreak ?? 0}
          bestStreak={daily?.bestStreak ?? 0}
          distribution={daily?.distribution ?? {}}
        />

        <div className="h-6" />

        <Block
          title="Unlimited"
          played={unlimited?.played ?? 0}
          wins={unlimited?.wins ?? 0}
          currentStreak={unlimited?.currentStreak ?? 0}
          bestStreak={unlimited?.bestStreak ?? 0}
          distribution={unlimited?.distribution ?? {}}
        />
      </div>
    </div>
  );
}

function Block({
  title,
  played,
  wins,
  currentStreak,
  bestStreak,
  distribution,
}: {
  title: string;
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  distribution: Record<string, number>;
}) {
  const winPct = played ? Math.round((wins / played) * 100) : 0;
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm uppercase tracking-wider text-muted mb-3">
        {title}
      </h3>
      {played === 0 ? (
        <p className="text-xs text-muted">
          No games played yet. Your stats will appear here once you finish one.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <Stat label="Played" value={played} />
            <Stat label="Win %" value={winPct} />
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-mono text-xl">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
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
            <div className="flex-1 bg-surface-2 rounded overflow-hidden h-5 relative">
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
