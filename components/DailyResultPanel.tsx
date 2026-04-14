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
  // "Beat N% of players" = number of other players whose score was
  // strictly worse than yours (percentile as already computed by the API).
  // Singular "player" when only one other player has played.
  const beatPct = data?.percentile ?? null;
  const others = data ? Math.max(0, data.aggregate.total - 1) : 0;

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

      {loading && (
        <p className="text-center text-muted text-sm">Loading global stats…</p>
      )}
      {error && (
        <p className="text-center text-bad text-xs">
          Couldn&apos;t load global stats: {error}
        </p>
      )}
      {data && (
        <div className="space-y-3">
          {others > 0 ? (
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted">
                You beat
              </p>
              <p className="font-mono text-4xl text-accent leading-tight">
                {beatPct}
                <span className="text-lg">%</span>
              </p>
              <p className="text-xs text-muted">
                of {others} other player{others === 1 ? "" : "s"} today
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-muted">
              You&apos;re the first player on this puzzle — percentile updates
              as more players finish.
            </p>
          )}

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
  distribution: Record<string | number, number>;
  maxGuesses: number;
  yourGuess: number | null;
}) {
  const values = Object.values(distribution);
  const max = Math.max(1, ...values);
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted">
        Global distribution
      </p>
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
                  isMine
                    ? "bg-good/80 text-background"
                    : "bg-accent/60 text-background"
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
