"use client";

import type { PersonalStats } from "@/lib/persistence/localStore";

interface StatsPanelProps {
  stats: PersonalStats | null;
  maxGuesses: number;
}

export function StatsPanel({ stats, maxGuesses }: StatsPanelProps) {
  if (!stats) return null;

  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxBar = Math.max(1, ...Object.values(stats.distribution));

  return (
    <div className="w-full max-w-md mx-auto bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm uppercase tracking-wider text-muted mb-3">
        Unlimited stats
      </h3>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Stat label="Played" value={stats.played} />
        <Stat label="Win %" value={`${winPct}`} />
        <Stat label="Streak" value={stats.currentStreak} />
        <Stat label="Best" value={stats.bestStreak} />
      </div>
      <div className="space-y-1">
        {Array.from({ length: maxGuesses }, (_, i) => i + 1).map((n) => {
          const count = stats.distribution[String(n)] ?? 0;
          const pct = count === 0 ? 0 : Math.round((count / maxBar) * 100);
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
