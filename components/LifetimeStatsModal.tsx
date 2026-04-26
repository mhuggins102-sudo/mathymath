"use client";

import { useEffect, useMemo, useState } from "react";
import {
  combinedUnlimitedStats,
  dailyHistoryStats,
  loadDailyHistory,
  loadUnlimitedStats,
  type DailyHistoryStats,
  type PerDigitStats,
  type PersonalStats,
} from "@/lib/persistence/localStore";
import {
  DEFAULT_MAX_GUESSES,
  maxGuessesForDigits,
} from "@/lib/game/stateMachine";
import { Modal } from "./Modal";

export type StatsMode = "daily" | "unlimited" | "both";

/** Filter for the unlimited block when stats are split per digit count. */
type UnlimitedFilter = "all" | "5" | "6";

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
  const [unlimitedFilter, setUnlimitedFilter] =
    useState<UnlimitedFilter>("all");

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

  // Resolve which slice of the unlimited stats to render based on the
  // toggle. "All" combines 5- and 6-digit; "5" / "6" pick one bucket.
  // The chart's max-guesses cap also flexes per filter so the 5-digit
  // view doesn't render an empty 8th row. Streaks come from the same
  // slice so a "5-digit" view shows the streak of 5-digit-only games.
  const unlimitedView: {
    stats: PerDigitStats;
    maxGuesses: number;
  } = useMemo(() => {
    if (!unlimited) {
      return {
        stats: {
          played: 0,
          wins: 0,
          distribution: {},
          currentStreak: 0,
          bestStreak: 0,
        },
        maxGuesses: maxGuessesForDigits(5),
      };
    }
    if (unlimitedFilter === "5") {
      return {
        stats: unlimited.byDigits["5"],
        maxGuesses: maxGuessesForDigits(5),
      };
    }
    if (unlimitedFilter === "6") {
      return {
        stats: unlimited.byDigits["6"],
        maxGuesses: maxGuessesForDigits(6),
      };
    }
    return {
      stats: combinedUnlimitedStats(unlimited),
      maxGuesses: maxGuessesForDigits(6),
    };
  }, [unlimited, unlimitedFilter]);

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
            maxGuesses={DEFAULT_MAX_GUESSES}
          />
        )}
        {(mode === "unlimited" || mode === "both") && (
          <Block
            title="Unlimited"
            showTitle={mode === "both"}
            played={unlimitedView.stats.played}
            wins={unlimitedView.stats.wins}
            currentStreak={unlimitedView.stats.currentStreak}
            bestStreak={unlimitedView.stats.bestStreak}
            distribution={unlimitedView.stats.distribution}
            maxGuesses={unlimitedView.maxGuesses}
            header={
              <UnlimitedFilterToggle
                value={unlimitedFilter}
                onChange={setUnlimitedFilter}
              />
            }
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

function UnlimitedFilterToggle({
  value,
  onChange,
}: {
  value: UnlimitedFilter;
  onChange: (next: UnlimitedFilter) => void;
}) {
  const options: { v: UnlimitedFilter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "5", label: "5-digit" },
    { v: "6", label: "6-digit" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Unlimited stats filter"
      className="grid grid-cols-3 gap-1 bg-surface rounded-md p-1 mb-3"
    >
      {options.map((opt) => {
        const selected = value === opt.v;
        return (
          <button
            key={opt.v}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.v)}
            className={`text-[11px] font-semibold py-1 rounded transition ${
              selected
                ? "bg-accent/80 text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function meanFromDistribution(
  distribution: Record<string, number>,
  losses: number,
  maxGuesses: number,
): number | null {
  let sum = 0;
  let n = 0;
  for (const [k, count] of Object.entries(distribution)) {
    const g = Number(k);
    if (!Number.isFinite(g)) continue;
    sum += g * count;
    n += count;
  }
  // Losses count as one more than the max budget so the mean reflects
  // overall skill, not just winning speed. Uses the larger budget when
  // unlimited mixes 5- and 6-digit games.
  sum += losses * (maxGuesses + 1);
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
  maxGuesses,
  header,
}: {
  title: string;
  showTitle: boolean;
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  distribution: Record<string, number>;
  maxGuesses: number;
  /** Optional element rendered between the title and the metrics — used
   *  by the unlimited block to host its filter toggle. */
  header?: React.ReactNode;
}) {
  const winPct = played ? Math.round((wins / played) * 100) : 0;
  const losses = Math.max(0, played - wins);
  const meanVal = meanFromDistribution(distribution, losses, maxGuesses);
  const meanLabel = meanVal === null ? "—" : meanVal.toFixed(1);

  return (
    <div className="bg-surface-2 rounded-lg border border-border p-3">
      {showTitle && (
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">
          {title}
        </h3>
      )}
      {header}
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
            maxGuesses={maxGuesses}
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
