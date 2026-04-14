"use client";

import { Countdown } from "./Countdown";
import type { DailyHistoryStats } from "@/lib/persistence/localStore";

export interface DailyPercentileData {
  percentile: number;
  aggregate: {
    total: number;
    wins: number;
    distribution: Record<number, number>;
  };
}

interface DailyResultPanelProps {
  won: boolean;
  guessCount: number;
  target: string;
  data: DailyPercentileData | null;
  loading: boolean;
  error: string | null;
  maxGuesses: number;
  personal: DailyHistoryStats | null;
  onShare?: () => void;
}

export function DailyResultPanel({
  won,
  guessCount,
  target,
  data,
  loading,
  error,
  maxGuesses,
  personal,
  onShare,
}: DailyResultPanelProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="text-center">
        <p
          className={`font-semibold text-lg ${won ? "text-good" : "text-bad"}`}
        >
          {won
            ? `Solved in ${guessCount} ${guessCount === 1 ? "guess" : "guesses"}!`
            : "Out of guesses."}
        </p>
        {!won && (
          <p className="text-muted text-sm mt-1">
            Target was{" "}
            <span className="font-mono font-bold text-foreground">{target}</span>
          </p>
        )}
      </div>

      {/* Personal daily stats — always present from the first solve. */}
      {personal && personal.played > 0 && (
        <PersonalBlock
          stats={personal}
          maxGuesses={maxGuesses}
          yourGuess={won ? guessCount : null}
        />
      )}

      {/* Global stats — best-effort; may be limited without a persistent DB. */}
      {loading && (
        <p className="text-center text-muted text-sm">Loading global stats…</p>
      )}
      {error && (
        <p className="text-center text-bad text-xs">
          Couldn&apos;t load global stats: {error}
        </p>
      )}
      {data && (
        <div className="pt-1 border-t border-border/60 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted text-center">
            Global distribution
          </p>
          <div className="text-center text-xs text-muted">
            {data.aggregate.total} player{data.aggregate.total === 1 ? "" : "s"}
            {data.aggregate.total > 1 && (
              <>
                {" · "}
                <span className="text-accent font-mono">
                  {data.percentile}%
                </span>{" "}
                percentile
              </>
            )}
          </div>
          <DistributionBars
            distribution={data.aggregate.distribution}
            maxGuesses={maxGuesses}
            yourGuess={won ? guessCount : null}
          />
        </div>
      )}

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className="w-full bg-accent/80 text-background font-semibold py-2 rounded-lg active:scale-95"
        >
          Share
        </button>
      )}

      <Countdown />
    </div>
  );
}

function PersonalBlock({
  stats,
  maxGuesses,
  yourGuess,
}: {
  stats: DailyHistoryStats;
  maxGuesses: number;
  yourGuess: number | null;
}) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted text-center">
        Your dailies
      </p>
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Played" value={stats.played} />
        <Stat label="Win %" value={winPct} />
        <Stat label="Streak" value={stats.currentStreak} />
        <Stat label="Best" value={stats.bestStreak} />
      </div>
      <DistributionBars
        distribution={stats.distribution}
        maxGuesses={maxGuesses}
        yourGuess={yourGuess}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-mono text-lg">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function DistributionBars({
  distribution,
  maxGuesses,
  yourGuess,
}: {
  distribution: Record<string | number, number>;
  maxGuesses: number;
  yourGuess: number | null;
}) {
  const values = Object.values(distribution);
  const max = Math.max(1, ...values);
  return (
    <div className="space-y-1">
      {Array.from({ length: maxGuesses }, (_, i) => i + 1).map((n) => {
        const count = distribution[n] ?? distribution[String(n)] ?? 0;
        const pct = count === 0 ? 0 : (count / max) * 100;
        const isMine = n === yourGuess;
        return (
          <div key={n} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-muted font-mono">{n}</span>
            <div className="flex-1 bg-surface-2 rounded overflow-hidden h-5 relative">
              <div
                className={`h-full flex items-center justify-end px-2 text-[10px] font-mono ${
                  isMine ? "bg-good/80 text-background" : "bg-accent/60 text-background"
                }`}
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
