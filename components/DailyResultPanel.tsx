"use client";

import { Countdown } from "./Countdown";

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
  onShare,
}: DailyResultPanelProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="text-center">
        <p
          className={`font-semibold text-lg ${
            won ? "text-good" : "text-bad"
          }`}
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

      {loading && (
        <p className="text-center text-muted text-sm">Calculating stats…</p>
      )}
      {error && (
        <p className="text-center text-bad text-xs">Couldn&apos;t load stats: {error}</p>
      )}
      {data && (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted">Your percentile</p>
            <p className="font-mono text-3xl text-accent">
              {data.percentile}
              <span className="text-base">%</span>
            </p>
            <p className="text-xs text-muted">
              beat {data.aggregate.total - 1 > 0 ? data.aggregate.total - 1 : 0} other{data.aggregate.total - 1 === 1 ? "" : "s"}
            </p>
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

function DistributionBars({
  distribution,
  maxGuesses,
  yourGuess,
}: {
  distribution: Record<number, number>;
  maxGuesses: number;
  yourGuess: number | null;
}) {
  const max = Math.max(1, ...Object.values(distribution));
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
        Global distribution
      </p>
      <div className="space-y-1">
        {Array.from({ length: maxGuesses }, (_, i) => i + 1).map((n) => {
          const count = distribution[n] ?? 0;
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
    </div>
  );
}
