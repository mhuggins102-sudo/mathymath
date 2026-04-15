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
import { seededRng } from "@/lib/game/seededRng";
import {
  generateDailyTarget,
  isDegenerateTarget,
} from "@/lib/game/targetGenerator";
import type { Clue, ClueId, ClueResult } from "@/lib/game/clues/types";

const DIGITS = 5;

/** "deck" scheme: strict P+P on top, rest shuffled, poof-discard
 *  (both cards in a pair are removed from the pool each round, so
 *  offered-but-unpicked cards never come back).
 *
 *  Seeds are derived from the game seed so two players on the same
 *  puzzle see the same deck — daily fairness is preserved. */
function buildDeck(seed: string): ClueId[] {
  const positional = CLUES.filter((c) => c.category === "positional");
  const other = CLUES.filter((c) => c.category !== "positional");

  const rngP = seededRng(`deckP:${seed}`);
  const shuffledP = fisherYates(
    positional.map((c) => c.id),
    rngP,
  );
  // Top two cards of the final deck are positional (strict pair-1
  // guarantee). The rest of the positional deck merges with the
  // "other" deck and gets its own shuffle.
  const topPP = shuffledP.slice(0, 2);
  const remainingP = shuffledP.slice(2);

  const rngRest = seededRng(`deckRest:${seed}`);
  const rest = fisherYates(
    [...remainingP, ...other.map((c) => c.id)],
    rngRest,
  );

  return [...topPP, ...rest];
}

function fisherYates<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Scheme = "current" | "deck";

function pairFor(
  scheme: Scheme,
  seed: string,
  chosenClueIds: readonly ClueId[],
  roundIndex: number,
  deck: ClueId[] | null,
): [Clue, Clue] {
  if (scheme === "current") {
    return pickTwoClues(seed, chosenClueIds);
  }
  // deck scheme: positions (roundIndex*2, roundIndex*2+1) of the
  // pre-built deck. Fall back to the last two ids if we ran off the
  // end (shouldn't happen — deck has 17, budget ≤ 8 → max 14 draws).
  const base = roundIndex * 2;
  const d = deck!;
  const aId = d[base] ?? d[d.length - 2];
  const bId = d[base + 1] ?? d[d.length - 1];
  return [getClueById(aId), getClueById(bId)];
}

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
    case "totalDeviation":
      return `TD:${r.value}`;
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
  /** Set of clue ids that were OFFERED (shown in a pair) this game,
   *  regardless of whether they were picked. */
  cluesOffered: Set<ClueId>;
  /** Categories of the two clues offered on pair 1, in order. */
  pair1Categories: [
    "positional" | "compositional" | "special",
    "positional" | "compositional" | "special",
  ] | null;
  /** For each chooser decision in this game: details about the two
   *  offered clues vs. which one the greedy solver picked. */
  decisions: Array<{
    pickedWeight: number;
    otherWeight: number;
    /** Expected remaining candidate count for the chosen clue. */
    pickedExp: number;
    /** Expected remaining candidate count for the option NOT chosen. */
    otherExp: number;
  }>;
}

function playOne(
  target: string,
  seed: string,
  budget: number,
  strategy: "greedy" | "weight",
  scheme: Scheme,
): SimStats {
  let candidates = ALL.slice();
  const chosen: ClueId[] = [];
  const deck = scheme === "deck" ? buildDeck(seed) : null;
  const stats: SimStats = {
    won: false,
    guessCount: 0,
    cluePicks: [],
    reductionsByClue: new Map(),
    cluesOffered: new Set(),
    pair1Categories: null,
    decisions: [],
  };

  // Track how many chooser decisions we've made so far — drives which
  // slice of the deck we draw from in the "deck" scheme. (Not the same
  // as guessIndex because an exact-match win skips the chooser.)
  let roundIndex = 0;

  for (let g = 0; g < budget; g++) {
    const guess = candidates[0] ?? ALL[0];
    stats.guessCount += 1;

    if (guess === target) {
      stats.won = true;
      return stats;
    }
    if (g + 1 >= budget) return stats;

    const options = pairFor(scheme, seed, chosen, roundIndex, deck);
    roundIndex++;
    stats.cluesOffered.add(options[0].id);
    stats.cluesOffered.add(options[1].id);
    if (stats.pair1Categories === null) {
      stats.pair1Categories = [options[0].category, options[1].category];
    }
    const e0 = expectedRemaining(candidates, guess, options[0].id);
    const e1 = expectedRemaining(candidates, guess, options[1].id);

    // Strategy determines the pick; the off-strategy metrics (pickedExp /
    // otherExp / weight comparison) are still recorded for reporting.
    let pickedIdx: 0 | 1;
    if (strategy === "greedy") {
      pickedIdx = e0 <= e1 ? 0 : 1;
    } else {
      // "weight" strategy: always take the lower-weight option. On ties,
      // fall back to whichever the selector offered first (options[0]).
      if (options[0].weight < options[1].weight) pickedIdx = 0;
      else if (options[1].weight < options[0].weight) pickedIdx = 1;
      else pickedIdx = 0;
    }

    const pick = options[pickedIdx];
    const other = options[1 - pickedIdx];
    const pickedExp = pickedIdx === 0 ? e0 : e1;
    const otherExp = pickedIdx === 0 ? e1 : e0;
    chosen.push(pick.id);
    stats.cluePicks.push(pick.id);
    stats.decisions.push({
      pickedWeight: pick.weight,
      otherWeight: other.weight,
      pickedExp,
      otherExp,
    });

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
      const strategyEnv = (process.env.SIM_STRATEGY ?? "greedy").toLowerCase();
      if (strategyEnv !== "greedy" && strategyEnv !== "weight") {
        throw new Error(
          `SIM_STRATEGY must be "greedy" or "weight"; got ${strategyEnv}`,
        );
      }
      const strategy = strategyEnv as "greedy" | "weight";
      const schemeEnv = (process.env.SIM_SCHEME ?? "current").toLowerCase();
      if (schemeEnv !== "current" && schemeEnv !== "deck") {
        throw new Error(
          `SIM_SCHEME must be "current" or "deck"; got ${schemeEnv}`,
        );
      }
      const scheme = schemeEnv as Scheme;
      console.log(
        `\nSimulating ${N} daily puzzles  budget=${BUDGET}  strategy=${strategy}  scheme=${scheme}`,
      );
      if (strategy === "weight") {
        console.log(
          "  (always picks the lower-weight option; ties → first offered)",
        );
      } else {
        console.log(
          "  (greedy: picks whichever option most reduces the candidate set)",
        );
      }
      if (scheme === "deck") {
        console.log(
          "  (deck: strict P+P on top, rest shuffled; offered-but-unpicked cards are discarded permanently)",
        );
      } else {
        console.log(
          "  (current: weighted random pair from not-yet-chosen pool; unpicked cards can reappear)",
        );
      }
      console.log(
        `Candidate pool after degenerate filter: ${ALL.length} / 100000`,
      );

      const runStats: SimStats[] = [];
      const globalReductions = new Map<ClueId, number[]>();
      const pickCount = new Map<ClueId, number>();
      const offeredCount = new Map<ClueId, number>();

      for (let i = 0; i < N; i++) {
        const date = `sim-${i}`;
        const target = generateDailyTarget(date, DIGITS);
        const r = playOne(target, date, BUDGET, strategy, scheme);
        runStats.push(r);
        for (const id of r.cluePicks) {
          pickCount.set(id, (pickCount.get(id) ?? 0) + 1);
        }
        for (const id of r.cluesOffered) {
          offeredCount.set(id, (offeredCount.get(id) ?? 0) + 1);
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

      // Pair-1 composition — diagnostic for the "positional always on
      // turn 1" property. Pair 1 can be 2P (two positional), 1P+1CS,
      // or 0P (two compositional/special). The deck scheme should hit
      // 2P on 100% of games; the current scheme hits it randomly.
      let p1_2P = 0,
        p1_1P = 0,
        p1_0P = 0;
      for (const r of runStats) {
        if (!r.pair1Categories) continue;
        const positionals = r.pair1Categories.filter(
          (c) => c === "positional",
        ).length;
        if (positionals === 2) p1_2P++;
        else if (positionals === 1) p1_1P++;
        else p1_0P++;
      }
      console.log("\n--- pair-1 composition ---");
      console.log(
        `  2 positional: ${p1_2P} / ${N} (${((p1_2P / N) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  1 positional: ${p1_1P} / ${N} (${((p1_1P / N) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  0 positional: ${p1_0P} / ${N} (${((p1_0P / N) * 100).toFixed(1)}%)`,
      );

      console.log(
        "\n--- per-clue (offered rate, picks, avg remaining after pick) ---",
      );
      const clueLines = CLUES.map((c) => {
        const picks = pickCount.get(c.id) ?? 0;
        const offered = offeredCount.get(c.id) ?? 0;
        const rs = globalReductions.get(c.id) ?? [];
        const avgRatio =
          rs.length === 0 ? null : rs.reduce((s, x) => s + x, 0) / rs.length;
        return {
          name: c.name,
          id: c.id,
          weight: c.weight,
          category: c.category,
          picks,
          offered,
          avgRatio,
        };
      });
      clueLines.sort((a, b) => b.picks - a.picks);
      for (const row of clueLines) {
        const ratioStr =
          row.avgRatio === null
            ? "    —"
            : `${(row.avgRatio * 100).toFixed(1)}%`.padStart(6);
        const cat =
          row.category === "positional"
            ? "P"
            : row.category === "compositional"
              ? "C"
              : "S";
        const offeredPct = `${((row.offered / N) * 100).toFixed(0)}%`.padStart(
          4,
        );
        console.log(
          `  [${cat}] ${row.name.padEnd(16)} w=${row.weight.toFixed(1)}  offered=${offeredPct}  picks=${String(row.picks).padStart(5)}  remaining=${ratioStr}`,
        );
      }

      // --- chooser meaningfulness ---
      //
      // For every decision the solver made, compare:
      //   - the WEIGHT of the picked vs the unpicked option. A lower
      //     weight = rarer = designed-as-stronger. If the solver usually
      //     picks the lower-weight clue, the weight ranking is agreeing
      //     with real info value in-context.
      //   - the expected-remaining RATIO between the two. Close to 1.0
      //     means the two options are near-equally informative (the
      //     decision has texture); close to 0 means one crushes the
      //     other (the choice is obvious).
      let decisionsTotal = 0;
      let lowerWeightPicked = 0;
      let equalWeight = 0;
      const closenessBuckets = {
        "obvious (≤25%)": 0,
        "strong (25-50%)": 0,
        "lean (50-75%)": 0,
        "close (75-100%]": 0,
        "equal (ties)": 0,
      };
      for (const r of runStats) {
        for (const d of r.decisions) {
          decisionsTotal += 1;
          if (d.pickedWeight === d.otherWeight) equalWeight += 1;
          else if (d.pickedWeight < d.otherWeight) lowerWeightPicked += 1;
          // closeness = smaller expected / larger expected
          const minE = Math.min(d.pickedExp, d.otherExp);
          const maxE = Math.max(d.pickedExp, d.otherExp);
          if (maxE === 0) {
            closenessBuckets["equal (ties)"] += 1;
          } else {
            const c = minE / maxE;
            if (c === 1) closenessBuckets["equal (ties)"] += 1;
            else if (c <= 0.25) closenessBuckets["obvious (≤25%)"] += 1;
            else if (c <= 0.5) closenessBuckets["strong (25-50%)"] += 1;
            else if (c <= 0.75) closenessBuckets["lean (50-75%)"] += 1;
            else closenessBuckets["close (75-100%]"] += 1;
          }
        }
      }
      console.log("\n--- chooser meaningfulness ---");
      console.log(`total decisions:         ${decisionsTotal}`);
      const nonTie = decisionsTotal - equalWeight;
      console.log(
        `lower-weight option picked: ${lowerWeightPicked} / ${nonTie} non-tie (${(
          (lowerWeightPicked / Math.max(1, nonTie)) *
          100
        ).toFixed(1)}%)`,
      );
      console.log(`equal-weight decisions:  ${equalWeight}`);
      console.log(
        "\n  Expected-remaining ratio (min/max) distribution:",
      );
      console.log(
        "    (lower = one option crushes the other; higher = real call)",
      );
      for (const [label, count] of Object.entries(closenessBuckets)) {
        const pct = ((count / Math.max(1, decisionsTotal)) * 100).toFixed(1);
        const bar = "█".repeat(Math.round((count / decisionsTotal) * 40));
        console.log(
          `    ${label.padEnd(18)}  ${String(count).padStart(5)}  ${pct.padStart(5)}%  ${bar}`,
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
