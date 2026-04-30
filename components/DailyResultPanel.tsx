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
  /** When provided, renders a "show puzzle" link at the bottom that
   *  dismisses the panel so the player can see their finished grid. */
  onDismiss?: () => void;
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
  onDismiss,
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
        <p className="text-center text-muted text-xs">
          {/* Older puzzles whose saved history predates the redraws-
              persistence fix can't be re-validated server-side. Those
              come back as `history_invalid` here; show a friendly
              note instead of the raw error code. Other failures
              (network, server) still surface generically. */}
          {error === "history_invalid"
            ? "Global stats unavailable for this puzzle."
            : "Couldn't load global stats. Try again later."}
        </p>
      )}
      {data && (
        <div className="space-y-3">
          {/* "You beat X%" is a win-only bragging line. It's suppressed
              when the player lost (no % to brag about), when they won
              but beat nobody (beatPct = 0 — awkward), and when they're
              the first player on this puzzle (separate empty-state). */}
          {others > 0 && won && beatPct !== null && beatPct > 0 ? (
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
          ) : others === 0 ? (
            <p className="text-center text-xs text-muted">
              You&apos;re the first player on this puzzle — percentile updates
              as more players finish.
            </p>
          ) : null}

          <DistributionBars
            distribution={data.aggregate.distribution}
            maxGuesses={maxGuesses}
            yourGuess={won ? guessCount : null}
            losses={Math.max(0, data.aggregate.total - data.aggregate.wins)}
            youLost={!won}
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

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="w-full text-xs text-muted hover:text-foreground underline underline-offset-4 py-1"
        >
          show puzzle
        </button>
      )}
    </div>
  );
}

function DistributionBars({
  distribution,
  maxGuesses,
  yourGuess,
  losses,
  youLost,
}: {
  distribution: Record<string | number, number>;
  maxGuesses: number;
  yourGuess: number | null;
  losses: number;
  youLost: boolean;
}) {
  const values = Object.values(distribution);
  // Normalize bar widths against the max across both wins and DNFs so
  // every bar is drawn to the same scale.
  const max = Math.max(1, ...values, losses);
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
      {/* DNF row: players who ran out of guesses on this puzzle. */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className="w-4 text-muted font-mono"
          aria-label="did not finish"
          title="Did not finish"
        >
          ✕
        </span>
        <div className="flex-1 bg-surface-2 rounded overflow-hidden h-5 relative">
          <div
            className={`h-full flex items-center justify-end px-2 text-[10px] font-mono ${
              youLost ? "bg-bad/80 text-background" : "bg-bad/50 text-background"
            }`}
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
