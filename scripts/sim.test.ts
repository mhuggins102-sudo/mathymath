/**
 * Greedy-info solver simulation, runnable under vitest.
 *
 * Models a "smart player" who:
 *   1. Submits any plausible remaining target as a guess (first-candidate
 *      heuristic — cheap, and a floor on performance).
 *   2. Is offered two clues by the real clueSelector (same path / weight
 *      logic as the app).
 *   3. Picks the clue that most reduces the remaining candidate set, using
 *      the expected-bucket-size heuristic (Σ|b|² / N).
 *   4. Applies the received clue result and loops.
 *
 * Invoke:
 *   pnpm sim        # defaults: N=2000, budget=8
 *   SIM_N=5000 SIM_BUDGET=7 pnpm sim
 *
 * Output is whatever vitest streams to stdout via console.log.
 */
import { describe, it, expect } from "vitest";
import { CLUES, getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import {
  generateDailyTarget,
  isDegenerateTarget,
} from "@/lib/game/targetGenerator";
import type { ClueId, ClueResult } from "@/lib/game/clues/types";

const DIGITS = 5;

function allCandidates(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 10 ** DIGITS; i++) {
    const s = String(i).padStart(DIGITS, "0");
    if (!isDegenerateTarget(s)) out.push(s);
  }
  return out;
}

const ALL = allCandidates();

function resultKey(r: ClueResult): string {
  switch (r.kind) {
    case "bullseyes":
      return "B:" + r.hits.map((h) => (h ? "1" : "0")).join("");
    case "higherLower":
      return "H:" + r.cmp.join(",");
    case "within2":
      return "W:" + r.mask.map((m) => (m ? "1" : "0")).join("");
    case "parityMask":
      return "P:" + r.matches.map((m) => (m ? "1" : "0")).join("");
    case "oracle":
      return `O:${r.slot}:${r.digit}`;
    case "thermometer":
      return "T:" + r.tier.join(",");
    case "sumDelta":
      return `SD:${r.delta}`;
    case "digitOverlap":
      return `DO:${r.count}`;
    case "parityBalance":
      return `PB:${r.cmp}`;
    case "primeCount":
      return `PC:${r.cmp}`;
    case "rangeCompare":
      return `RC:${r.cmp}`;
    case "containsDigit":
      return `CD:${r.digit}:${r.present ? 1 : 0}`;
    case "distinctDigits":
      return `DD:${r.count}`;
    case "median":
      return `M:${r.cmp}`;
    case "divisibleBy":
      return `DB:${r.divisor ?? "n"}:${r.present ? 1 : 0}`;
  }
}

function expectedRemaining(
  candidates: readonly string[],
  guess: string,
  clueId: ClueId,
): number {
  const clue = getClueById(clueId);
  const buckets = new Map<string, number>();
  for (const t of candidates) {
    const r = clue.compute(guess, t);
    const k = resultKey(r);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  let sum = 0;
  for (const v of buckets.values()) sum += v * v;
  return sum / candidates.length;
}

function filterByResult(
  candidates: readonly string[],
  guess: string,
  clueId: ClueId,
  result: ClueResult,
): string[] {
  const clue = getClueById(clueId);
  const key = resultKey(result);
  const out: string[] = [];
  for (const t of candidates) {
    if (resultKey(clue.compute(guess, t)) === key) out.push(t);
  }
  return out;
}

interface SimStats {
  won: boolean;
  guessCount: number;
  cluePicks: ClueId[];
  reductionsByClue: Map<ClueId, number[]>;
}

function playOne(target: string, seed: string, budget: number): SimStats {
  let candidates = ALL.slice();
  const chosen: ClueId[] = [];
  const stats: SimStats = {
    won: false,
    guessCount: 0,
    cluePicks: [],
    reductionsByClue: new Map(),
  };

  for (let g = 0; g < budget; g++) {
    const guess = candidates[0] ?? ALL[0];
    stats.guessCount += 1;

    if (guess === target) {
      stats.won = true;
      return stats;
    }
    if (g + 1 >= budget) return stats;

    const options = pickTwoClues(seed, chosen);
    const e0 = expectedRemaining(candidates, guess, options[0].id);
    const e1 = expectedRemaining(candidates, guess, options[1].id);
    const pick = e0 <= e1 ? options[0] : options[1];
    chosen.push(pick.id);
    stats.cluePicks.push(pick.id);

    const result = pick.compute(guess, target);
    const before = candidates.length;
    candidates = filterByResult(candidates, guess, pick.id, result);
    const ratio = candidates.length / Math.max(1, before);
    const arr = stats.reductionsByClue.get(pick.id) ?? [];
    arr.push(ratio);
    stats.reductionsByClue.set(pick.id, arr);
  }
  return stats;
}

// Gated: only runs when RUN_SIM=1 (set by the `pnpm sim` script). The
// default `pnpm test` picks up this file but the guard skips it so the
// regular test run stays fast.
const runSim = process.env.RUN_SIM === "1";

describe.skipIf(!runSim)("greedy-info simulation", () => {
  it(
    "measures win rate, guess distribution, and per-clue usefulness",
    { timeout: 600_000 },
    () => {
      const N = Number(process.env.SIM_N ?? 2000);
      const BUDGET = Number(process.env.SIM_BUDGET ?? 8);
      console.log(`\nSimulating ${N} daily puzzles with budget=${BUDGET}`);
      console.log(
        `Candidate pool after degenerate filter: ${ALL.length} / 100000`,
      );

      const runStats: SimStats[] = [];
      const globalReductions = new Map<ClueId, number[]>();
      const pickCount = new Map<ClueId, number>();

      for (let i = 0; i < N; i++) {
        const date = `sim-${i}`;
        const target = generateDailyTarget(date, DIGITS);
        const r = playOne(target, date, BUDGET);
        runStats.push(r);
        for (const id of r.cluePicks) {
          pickCount.set(id, (pickCount.get(id) ?? 0) + 1);
        }
        for (const [id, ratios] of r.reductionsByClue) {
          const cur = globalReductions.get(id) ?? [];
          cur.push(...ratios);
          globalReductions.set(id, cur);
        }
      }

      const wins = runStats.filter((r) => r.won);
      const dist: Record<number, number> = {};
      for (const r of wins) dist[r.guessCount] = (dist[r.guessCount] ?? 0) + 1;
      const meanWins =
        wins.reduce((s, r) => s + r.guessCount, 0) / Math.max(1, wins.length);

      console.log("\n--- overall ---");
      console.log(`win rate:        ${((wins.length / N) * 100).toFixed(1)}%`);
      console.log(`mean (wins):     ${meanWins.toFixed(2)}`);
      console.log("distribution:");
      for (let g = 1; g <= BUDGET; g++) {
        const n = dist[g] ?? 0;
        const bar = "█".repeat(Math.round((n / N) * 40));
        console.log(`  ${g}: ${String(n).padStart(5)} ${bar}`);
      }
      const losses = N - wins.length;
      console.log(
        `  ✕: ${String(losses).padStart(5)} ${"█".repeat(Math.round((losses / N) * 40))}`,
      );

      console.log(
        "\n--- per-clue (picks, avg remaining after pick as % of before) ---",
      );
      const clueLines = CLUES.map((c) => {
        const picks = pickCount.get(c.id) ?? 0;
        const rs = globalReductions.get(c.id) ?? [];
        const avgRatio =
          rs.length === 0 ? null : rs.reduce((s, x) => s + x, 0) / rs.length;
        return {
          name: c.name,
          id: c.id,
          weight: c.weight,
          category: c.category,
          picks,
          avgRatio,
        };
      });
      clueLines.sort((a, b) => b.picks - a.picks);
      for (const row of clueLines) {
        const ratioStr =
          row.avgRatio === null
            ? "    —"
            : `${(row.avgRatio * 100).toFixed(1)}%`.padStart(6);
        const cat = row.category === "positional" ? "P" : "C";
        console.log(
          `  [${cat}] ${row.name.padEnd(16)} w=${row.weight.toFixed(1)}  picks=${String(row.picks).padStart(5)}  remaining=${ratioStr}`,
        );
      }

      // Smoke assertion: with a real solver, we should not be winning 0%
      // and we should not be winning 100% (either would suggest a broken
      // clue pipeline or a degenerate sim).
      expect(wins.length / N).toBeGreaterThan(0.05);
      expect(wins.length / N).toBeLessThan(0.999);
    },
  );
});
