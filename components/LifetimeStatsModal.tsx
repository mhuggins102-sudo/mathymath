"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dailyHistoryStats,
  loadDailyHistory,
  loadUnlimitedStats,
  sliceUnlimitedStats,
  type DailyHistoryStats,
  type PerDigitStats,
  type PersonalStats,
  type StatsDifficulty,
} from "@/lib/persistence/localStore";
import {
  DEFAULT_MAX_GUESSES,
  HARD_MAX_GUESSES,
} from "@/lib/game/stateMachine";
import { Modal } from "./Modal";

export type StatsMode = "daily" | "unlimited" | "both";

/** Filter for the unlimited block: digit count + difficulty mode. */
type DigitFilter = "all" | "5" | "6";
type DifficultyFilter = "all" | StatsDifficulty;

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
  const [digitFilter, setDigitFilter] = useState<DigitFilter>("all");
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>("all");

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
  // two filter rows. "All" combines on either axis. The chart's
  // max-guesses cap depends on difficulty: Hard games cap at 7 guesses
  // (a Hard distribution shows row 7 as the last bar). When difficulty
  // is "all" we use the looser Normal cap (8) so Normal wins fit; if
  // the slice is purely Hard the chart trims to 7. Streaks pass through
  // from the matching bucket(s) via sliceUnlimitedStats.
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
        maxGuesses: DEFAULT_MAX_GUESSES,
      };
    }
    const stats = sliceUnlimitedStats(unlimited, {
      digit: digitFilter,
      difficulty: difficultyFilter,
    });
    const maxGuesses =
      difficultyFilter === "hard" ? HARD_MAX_GUESSES : DEFAULT_MAX_GUESSES;
    return { stats, maxGuesses };
  }, [unlimited, digitFilter, difficultyFilter]);

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
              <div className="space-y-1.5 mb-3">
                <FilterRow<DigitFilter>
                  ariaLabel="Unlimited stats — number length filter"
                  options={[
                    { v: "all", label: "All" },
                    { v: "5", label: "5-digit" },
                    { v: "6", label: "6-digit" },
                  ]}
                  value={digitFilter}
                  onChange={setDigitFilter}
                />
                <FilterRow<DifficultyFilter>
                  ariaLabel="Unlimited stats — difficulty filter"
                  options={[
                    { v: "all", label: "All" },
                    { v: "normal", label: "Normal" },
                    { v: "hard", label: "Hard" },
                  ]}
                  value={difficultyFilter}
                  onChange={setDifficultyFilter}
                />
              </div>
            }
          />
        )}
      </div>
    </>
  );

  // All three call sites — home ("both"), daily, unlimited — share
  // the same overlay aesthetic now: centered card on a translucent
  // backdrop, click outside or hit Escape to close. The mode prop
  // still drives WHICH stat blocks render; only the chrome is shared.
  return (
    <Modal open={open} onClose={onClose} titleId={titleId} variant="overlay">
      <div className="bg-surface rounded-xl border border-border shadow-2xl p-4">
        {content}
      </div>
    </Modal>
  );
}

/** Generic 3-option segmented filter. Used for both the digit-count
 *  and the difficulty-mode rows in the unlimited stats block. */
function FilterRow<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: { v: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-1 bg-surface rounded-md p-1"
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
  // Bars 4..maxGuesses always render individually. Scores 1-3 start
  // consolidated into a "≤3" bar and split out one at a time as the
  // player achieves them: scoring a 3 promotes 3 to its own bar (the
  // bucket becomes "≤2"); scoring a 2 promotes 2 (bucket "≤1"); a 1
  // splits everything apart.
  const lowestAchieved =
    (distribution["1"] ?? 0) > 0
      ? 1
      : (distribution["2"] ?? 0) > 0
      ? 2
      : (distribution["3"] ?? 0) > 0
      ? 3
      : 4;
  const consolidatedCap = lowestAchieved - 1; // 0..3
  // Sum of distribution[k] for k in [1..consolidatedCap]. By
  // construction those slots are all zero (the lowest non-zero score
  // is `lowestAchieved`), so this stays at zero in practice — but we
  // sum anyway so the bar reflects truth if data is ever pre-seeded
  // or migrated from an older shape.
  let consolidatedCount = 0;
  for (let k = 1; k <= consolidatedCap; k++) {
    consolidatedCount += distribution[String(k)] ?? 0;
  }

  // Rows we'll render: optional "≤N" then individual lowestAchieved..maxGuesses.
  const rows: { key: string; label: string; count: number }[] = [];
  if (consolidatedCap >= 1) {
    rows.push({
      key: `lte-${consolidatedCap}`,
      label: `≤${consolidatedCap}`,
      count: consolidatedCount,
    });
  }
  for (let n = lowestAchieved; n <= maxGuesses; n++) {
    rows.push({ key: String(n), label: String(n), count: distribution[String(n)] ?? 0 });
  }

  // Include DNFs in the max so the losses bar shares the same scale.
  const max = Math.max(1, ...rows.map((r) => r.count), losses);
  return (
    <div className="space-y-1">
      {rows.map((row) => {
        const pct = row.count === 0 ? 0 : (row.count / max) * 100;
        return (
          <div key={row.key} className="flex items-center gap-2 text-xs">
            <span className="w-7 text-muted font-mono text-right">{row.label}</span>
            <div className="flex-1 bg-surface rounded overflow-hidden h-5 relative">
              <div
                className="bg-accent/60 h-full flex items-center justify-end px-2 text-[10px] font-mono text-background"
                style={{ width: `${Math.max(pct, row.count ? 12 : 0)}%` }}
              >
                {row.count || ""}
              </div>
            </div>
          </div>
        );
      })}
      {/* DNF row: games ended without a solve (ran out of guesses). */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className="w-7 text-muted font-mono text-right"
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
