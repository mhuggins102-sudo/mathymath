/**
 * Strategic-AI simulator.
 *
 * Runs N games each of:
 *   1. 5-digit Regular mode, MANUAL clue selection
 *   2. 5-digit Regular mode, AUTO (preselected) clue selection
 *
 * Both runs use the strategic AI from scripts/strategicAI.ts — locks
 * placed on high-confidence slots, redraws on weak pairs, category bias
 * on near-ties, Clue Reuse with the lock cost folded in.
 *
 * Output:
 *   - ASCII histograms + per-clue tables printed to console
 *   - JSON dump to scripts/strategicSim-output.json (consumed by
 *     scripts/sims-report.md authoring)
 *
 * Invoke:
 *   pnpm sim:strategic              # defaults: N=2000, BUDGET=8
 *   SIM_N=500 pnpm sim:strategic    # smaller pilot
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CLUES, getClueById } from "@/lib/game/clues/registry";
import { generateDailyTarget } from "@/lib/game/targetGenerator";
import type { ClueId } from "@/lib/game/clues/types";
import {
  allCandidates,
  META_CLUE_IDS,
  playStrategic,
  type GameStats,
} from "./strategicAI";

const DIGITS = 5;
const runSim = process.env.RUN_SIM === "1";

// ---------------------------------------------------------------------------
// Reporting helpers (ASCII-friendly; mirror sim.test.ts shape).
// ---------------------------------------------------------------------------

function median(arr: readonly number[]): number {
  if (arr.length === 0) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
function bar(n: number, max: number, width = 40): string {
  if (max <= 0) return "";
  return "█".repeat(Math.round((n / max) * width));
}

interface ReportRow {
  id: ClueId;
  name: string;
  category: "positional" | "compositional" | "special";
  offered: number;
  picks: number;
  pickRate: number;
  avgBits: number;
  medBits: number;
  totBits: number;
  meta: boolean;
}

function buildReport(games: GameStats[], n: number) {
  const offeredCount = new Map<ClueId, number>();
  const pickCount = new Map<ClueId, number>();
  const bitsPerPick = new Map<ClueId, number[]>();
  const reuseAppliedTo = new Map<ClueId, number>();

  for (const g of games) {
    for (const id of g.offeredIds) {
      offeredCount.set(id, (offeredCount.get(id) ?? 0) + 1);
    }
    for (const d of g.decisions) {
      // Attribute info-gain to the actual applied clue (when Clue Reuse
      // is in play, the "pickedId" is clueReuse but the bits came from
      // the reused clue). For uniform reporting we attribute to the
      // chooser pick — Clue Reuse picks are tracked separately below.
      pickCount.set(d.pickedId, (pickCount.get(d.pickedId) ?? 0) + 1);
      const arr = bitsPerPick.get(d.pickedId) ?? [];
      arr.push(d.bitsGained);
      bitsPerPick.set(d.pickedId, arr);
      if (d.pickedReusedId) {
        reuseAppliedTo.set(
          d.pickedReusedId,
          (reuseAppliedTo.get(d.pickedReusedId) ?? 0) + 1,
        );
      }
    }
  }

  const rows: ReportRow[] = CLUES.map((c) => {
    const offered = offeredCount.get(c.id) ?? 0;
    const picks = pickCount.get(c.id) ?? 0;
    const bitsArr = bitsPerPick.get(c.id) ?? [];
    const avgBits =
      bitsArr.length > 0
        ? bitsArr.reduce((s, x) => s + x, 0) / bitsArr.length
        : 0;
    const medBits = median(bitsArr);
    const totBits = bitsArr.reduce((s, x) => s + x, 0);
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      offered,
      picks,
      pickRate: offered > 0 ? picks / offered : 0,
      avgBits,
      medBits: Number.isNaN(medBits) ? 0 : medBits,
      totBits,
      meta: META_CLUE_IDS.has(c.id),
    };
  }).sort((a, b) => b.avgBits - a.avgBits);

  return { rows, reuseAppliedTo, n };
}

function printHistogram(games: GameStats[], budget: number, n: number) {
  const wins = games.filter((g) => g.won);
  const dist: Record<number, number> = {};
  for (const g of wins) dist[g.guessCount] = (dist[g.guessCount] ?? 0) + 1;
  const losses = n - wins.length;
  const meanWins =
    wins.length === 0
      ? 0
      : wins.reduce((s, g) => s + g.guessCount, 0) / wins.length;
  console.log("\n=== HISTOGRAM (guess count to win; ✕ = lost) ===");
  console.log(
    `win rate: ${((wins.length / n) * 100).toFixed(1)}%   mean (wins): ${meanWins.toFixed(2)}`,
  );
  const maxBucket = Math.max(...Object.values(dist), losses, 1);
  for (let k = 1; k <= budget; k++) {
    const c = dist[k] ?? 0;
    const pct = ((c / n) * 100).toFixed(1).padStart(5);
    console.log(`  ${k}: ${String(c).padStart(5)}  ${pct}%  ${bar(c, maxBucket)}`);
  }
  console.log(
    `  ✕: ${String(losses).padStart(5)}  ${((losses / n) * 100).toFixed(1).padStart(5)}%  ${bar(losses, maxBucket)}`,
  );
}

function printPerClueTable(rows: ReportRow[], n: number) {
  console.log("\n=== PER-CLUE TABLE (sorted by avg bits per pick) ===");
  console.log(
    "  CAT NAME              OFFERED  PICK%   PICKS  AVGBITS  MEDBITS  TOTBITS  META",
  );
  for (const r of rows) {
    const cat =
      r.category === "positional" ? "P" : r.category === "compositional" ? "C" : "S";
    const offeredPct = `${((r.offered / n) * 100).toFixed(0)}%`.padStart(6);
    const pickPct = `${(r.pickRate * 100).toFixed(1)}%`.padStart(6);
    console.log(
      `  [${cat}] ${r.name.padEnd(16)} ${offeredPct}  ${pickPct}  ${String(r.picks).padStart(5)}  ${r.avgBits.toFixed(2).padStart(6)}  ${r.medBits.toFixed(2).padStart(6)}  ${r.totBits.toFixed(0).padStart(6)}  ${r.meta ? "META" : ""}`,
    );
  }
}

function printLockEconomy(games: GameStats[]) {
  const totalLocks = games.reduce((s, g) => s + g.locks.length, 0);
  const correctLocks = games.reduce(
    (s, g) => s + g.locks.filter((l) => l.correct).length,
    0,
  );
  const totalRedraws = games.reduce((s, g) => s + g.redraws, 0);
  const totalReuses = games.reduce((s, g) => s + g.clueReusePicks, 0);
  console.log("\n=== LOCK ECONOMY ===");
  console.log(
    `  locks placed     : ${totalLocks}  (avg ${(totalLocks / games.length).toFixed(2)}/game)`,
  );
  console.log(
    `  locks correct    : ${correctLocks}  (${((correctLocks / Math.max(1, totalLocks)) * 100).toFixed(1)}% hit rate)`,
  );
  console.log(
    `  redraws          : ${totalRedraws}  (avg ${(totalRedraws / games.length).toFixed(2)}/game)`,
  );
  console.log(
    `  clue reuse picks : ${totalReuses}  (avg ${(totalReuses / games.length).toFixed(2)}/game)`,
  );
}

function snapshotForJson(label: string, games: GameStats[], budget: number, n: number) {
  const report = buildReport(games, n);
  const wins = games.filter((g) => g.won);
  const dist: Record<number, number> = {};
  for (const g of wins) dist[g.guessCount] = (dist[g.guessCount] ?? 0) + 1;
  const totalLocks = games.reduce((s, g) => s + g.locks.length, 0);
  const correctLocks = games.reduce(
    (s, g) => s + g.locks.filter((l) => l.correct).length,
    0,
  );
  return {
    label,
    n,
    budget,
    digits: DIGITS,
    winRate: wins.length / n,
    meanGuessesOnWin:
      wins.length === 0
        ? 0
        : wins.reduce((s, g) => s + g.guessCount, 0) / wins.length,
    histogram: dist,
    losses: n - wins.length,
    perClue: report.rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      offered: r.offered,
      picks: r.picks,
      pickRate: r.pickRate,
      avgBits: r.avgBits,
      medBits: r.medBits,
      totBits: r.totBits,
      meta: r.meta,
    })),
    locks: {
      totalPlaced: totalLocks,
      correct: correctLocks,
      hitRate: totalLocks > 0 ? correctLocks / totalLocks : 0,
      avgPerGame: totalLocks / Math.max(1, n),
    },
    redraws: games.reduce((s, g) => s + g.redraws, 0),
    clueReusePicks: games.reduce((s, g) => s + g.clueReusePicks, 0),
    reuseAppliedTo: Array.from(report.reuseAppliedTo.entries()).map(
      ([id, count]) => ({ id, name: getClueById(id).name, count }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!runSim)("strategic-AI simulation", () => {
  it(
    "5-digit Regular mode — manual and auto with strategic AI",
    { timeout: 1800_000 },
    () => {
      const N = Number(process.env.SIM_N ?? 2000);
      const BUDGET = Number(process.env.SIM_BUDGET ?? 8);
      const pool = allCandidates(DIGITS);

      console.log(
        `\nSimulating ${N} games  digits=${DIGITS}  budget=${BUDGET}  mode=Regular  AI=strategic`,
      );
      console.log(`Candidate pool after degenerate filter: ${pool.length}`);

      // --- Manual mode -------------------------------------------------
      console.log("\n========== MANUAL CLUE SELECTION ==========");
      const manualGames: GameStats[] = [];
      for (let i = 0; i < N; i++) {
        const date = `sim-${i}`;
        const target = generateDailyTarget(date, DIGITS);
        manualGames.push(
          playStrategic({
            target,
            seed: date,
            digits: DIGITS,
            budget: BUDGET,
            mode: "manual",
            candidates: pool,
          }),
        );
      }
      printHistogram(manualGames, BUDGET, N);
      const manualReport = buildReport(manualGames, N);
      printPerClueTable(manualReport.rows, N);
      printLockEconomy(manualGames);

      // --- Auto mode ---------------------------------------------------
      console.log("\n========== AUTO (PRESELECTED) CLUE SELECTION ==========");
      const autoGames: GameStats[] = [];
      for (let i = 0; i < N; i++) {
        const date = `sim-auto-${i}`;
        const target = generateDailyTarget(date, DIGITS);
        autoGames.push(
          playStrategic({
            target,
            seed: date,
            digits: DIGITS,
            budget: BUDGET,
            mode: "auto",
            candidates: pool,
          }),
        );
      }
      printHistogram(autoGames, BUDGET, N);
      const autoReport = buildReport(autoGames, N);
      printPerClueTable(autoReport.rows, N);
      printLockEconomy(autoGames);

      // --- JSON dump ---------------------------------------------------
      const outPath = resolve(process.cwd(), "scripts/strategicSim-output.json");
      const payload = {
        runAt: new Date().toISOString(),
        manual: snapshotForJson("manual", manualGames, BUDGET, N),
        auto: snapshotForJson("auto", autoGames, BUDGET, N),
      };
      writeFileSync(outPath, JSON.stringify(payload, null, 2));
      console.log(`\nJSON written → ${outPath}`);

      // Sanity: each variant should win materially more than chance and
      // not always — the strategy gap study lives in sims-report.md.
      expect(manualGames.filter((g) => g.won).length / N).toBeGreaterThan(0.3);
      expect(autoGames.filter((g) => g.won).length / N).toBeGreaterThan(0.1);
    },
  );
});
