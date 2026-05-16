/**
 * Player-chooser simulator.
 *
 * Plays N games of Regular-mode 5-digit puzzles. Each game:
 *   1. Submits any plausible remaining target as the next guess
 *      (first-candidate heuristic — keeps the simulation cheap and is
 *      a lower bound on what a smart player would do).
 *   2. Asks the real `pickTwoClues(seed, chosen)` for the round's
 *      offered pair (matches the live deck because advancedMode
 *      defaults to false).
 *   3. Picks the clue that minimizes expected remaining candidates
 *      (Σ |bucket|² / N). Ties: take the option offered first.
 *   4. Applies the result and loops.
 *
 * The AI consults nothing about the clues except the sliced bucket
 * sizes it computes against its own candidate set — no `weight`, no
 * curated list, no hand-picked rankings. All over/under-powered
 * verdicts come from observed play.
 *
 * Invoke:
 *   pnpm sim                         # defaults: N=2000, BUDGET=8
 *   SIM_N=5000 SIM_BUDGET=8 pnpm sim
 */
import { describe, it, expect } from "vitest";
import { CLUES, getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { knownSlotsFromHistory } from "@/lib/game/certain";
import {
  generateDailyTarget,
  isDegenerateTarget,
} from "@/lib/game/targetGenerator";
import type {
  Clue,
  ClueId,
  ClueResult,
  ClueComputeContext,
} from "@/lib/game/clues/types";

const DIGITS = 5;

// Meta cards that don't reveal target info. The greedy AI doesn't
// model the lock economy, so its scores for these cards are not
// meaningful as a verdict on their design value — they're flagged in
// the report and excluded from the empirical over/under-powered call.
const META_CLUE_IDS: ReadonlySet<ClueId> = new Set<ClueId>([
  "extraLock",
  "clueReuse",
]);

// ---------------------------------------------------------------------------
// Candidate pool
// ---------------------------------------------------------------------------

function allCandidates(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 10 ** DIGITS; i++) {
    const s = String(i).padStart(DIGITS, "0");
    if (!isDegenerateTarget(s)) out.push(s);
  }
  return out;
}
const ALL = allCandidates();

// ---------------------------------------------------------------------------
// Result keying — collapse a ClueResult to a string so we can bucket
// candidates by "produces the same result". Bucket sizes drive the
// greedy info heuristic and the post-result candidate filter.
// ---------------------------------------------------------------------------

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
      return "DO:" + r.mask.map((m) => (m ? "1" : "0")).join("");
    case "statSummary":
      return `SS:${r.medianCmp},${r.minCmp},${r.maxCmp}`;
    case "digitClass":
      return `DCL:${r.evenCmp},${r.primeCmp},${r.diceCmp}`;
    case "containsDigit":
      return `CD:${r.picks.map((p) => `${p.digit}${p.present ? "y" : "n"}${p.exact ? "x" : ""}`).join(",")}`;
    case "distinctDigits":
      return `DD:${r.count}`;
    case "divisibleBy":
      return `DB:${r.divisors.join(",")}:${r.targetHasAny ? 1 : 0}`;
    case "totalDeviation":
      return `TD:${r.value}`;
    case "upsAndDowns":
      return `UD:${r.cmp}`;
    case "bullseyeTrend":
      return `BT:${r.delta}`;
    case "elimination":
      return "EL:" + r.mask.map((m) => (m ? "1" : "0")).join("");
    case "extraLock":
      return "EXTRA";
    case "clueReuse":
      return "REUSE";
  }
}

// ---------------------------------------------------------------------------
// Greedy scoring + candidate filtering
// ---------------------------------------------------------------------------

interface SimHistoryEntry {
  guess: string;
  clueId: ClueId;
  result: ClueResult;
}

function buildContext(
  history: readonly SimHistoryEntry[],
): ClueComputeContext {
  const knownSlots = knownSlotsFromHistory(history, DIGITS);
  return {
    knownSlots,
    priorResults: history.map((h) => h.result),
    priorGuesses: history.map((h) => h.guess),
  };
}

/** For every candidate target t, compute clueId(guess, t) under the
 *  current context, bucket by resultKey, and return Σ |b|² / N — the
 *  expected remaining-pool size if we picked this clue and saw a
 *  uniformly-random outcome. Lower is better. */
function expectedRemainingForClue(
  candidates: readonly string[],
  guess: string,
  clueId: ClueId,
  context: ClueComputeContext,
): number {
  const clue = getClueById(clueId);
  const buckets = new Map<string, number>();
  for (const t of candidates) {
    const r = clue.compute(guess, t, context);
    const k = resultKey(r);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  let sum = 0;
  for (const v of buckets.values()) sum += v * v;
  return sum / Math.max(1, candidates.length);
}

interface ReuseScore {
  /** Best prior clue to reuse (lowest expected-remaining). */
  reusedId: ClueId | null;
  /** Expected remaining if we reuse `reusedId`. Equals candidates.length
   *  when there's no prior clue to reuse. */
  expectedRemaining: number;
}

/** Models clueReuse: pick the prior clue that, applied to the current
 *  guess, minimizes expected remaining candidates. With no priors,
 *  reuse is information-empty (returns N). */
function scoreClueReuse(
  candidates: readonly string[],
  guess: string,
  context: ClueComputeContext,
  priorPicks: readonly ClueId[],
): ReuseScore {
  let best: ReuseScore = {
    reusedId: null,
    expectedRemaining: candidates.length,
  };
  const seen = new Set<ClueId>();
  for (const id of priorPicks) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (id === "clueReuse" || id === "extraLock") continue;
    const e = expectedRemainingForClue(candidates, guess, id, context);
    if (e < best.expectedRemaining) {
      best = { reusedId: id, expectedRemaining: e };
    }
  }
  return best;
}

/** Score for a candidate clue option in the chooser. For info clues
 *  this is just expectedRemainingForClue. For meta clues:
 *    - extraLock: bucket of N (no info gained).
 *    - clueReuse: scoreClueReuse over the AI's prior picks. */
function scoreOption(
  candidates: readonly string[],
  guess: string,
  clueId: ClueId,
  context: ClueComputeContext,
  priorPicks: readonly ClueId[],
): { expectedRemaining: number; reusedId?: ClueId } {
  if (clueId === "extraLock") {
    return { expectedRemaining: candidates.length };
  }
  if (clueId === "clueReuse") {
    const r = scoreClueReuse(candidates, guess, context, priorPicks);
    return {
      expectedRemaining: r.expectedRemaining,
      reusedId: r.reusedId ?? undefined,
    };
  }
  return {
    expectedRemaining: expectedRemainingForClue(
      candidates,
      guess,
      clueId,
      context,
    ),
  };
}

/** Filter candidates against an observed result. For info clues, keep
 *  candidates whose recomputed resultKey matches. For meta clues:
 *    - extraLock: no information, no filter.
 *    - clueReuse: should never reach here — caller resolves reuse to
 *      the underlying clue and filters by that clue's resultKey. */
function filterByResult(
  candidates: readonly string[],
  guess: string,
  clueId: ClueId,
  result: ClueResult,
  context: ClueComputeContext,
): string[] {
  if (clueId === "extraLock") return candidates.slice();
  const clue = getClueById(clueId);
  const key = resultKey(result);
  const out: string[] = [];
  for (const t of candidates) {
    if (resultKey(clue.compute(guess, t, context)) === key) out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// One game
// ---------------------------------------------------------------------------

interface DecisionRecord {
  /** 1-indexed round number (chooser decisions only). */
  round: number;
  pickedId: ClueId;
  otherId: ClueId;
  /** When pickedId is "clueReuse", the underlying clue actually applied. */
  pickedReusedId?: ClueId;
  /** When otherId is "clueReuse", the best reuse target at evaluation. */
  otherReusedId?: ClueId;
  pickedExp: number;
  otherExp: number;
  /** log2(before / max(after, 1)). Empirical bits gained on this pick. */
  bitsGained: number;
  candidatesBefore: number;
  candidatesAfter: number;
}

interface SimStats {
  won: boolean;
  guessCount: number;
  cluePicks: ClueId[];
  decisions: DecisionRecord[];
  /** Categories of the two clues offered on pair 1, in order. Null if
   *  the game ended before pair 1 was offered (rare). */
  pair1Categories:
    | ["positional" | "compositional" | "special", "positional" | "compositional" | "special"]
    | null;
  pair1PickedCategory: "positional" | "compositional" | "special" | null;
  /** Set of clue ids that were OFFERED in this game. */
  offeredIds: Set<ClueId>;
}

function playOne(target: string, seed: string, budget: number): SimStats {
  let candidates = ALL.slice();
  const history: SimHistoryEntry[] = [];
  const stats: SimStats = {
    won: false,
    guessCount: 0,
    cluePicks: [],
    decisions: [],
    pair1Categories: null,
    pair1PickedCategory: null,
    offeredIds: new Set(),
  };

  for (let g = 0; g < budget; g++) {
    const guess = candidates[0] ?? ALL[0];
    stats.guessCount += 1;

    if (guess === target) {
      stats.won = true;
      return stats;
    }
    if (g + 1 >= budget) return stats;

    const chosenSoFar = stats.cluePicks;
    const options = pickTwoClues(seed, chosenSoFar);
    stats.offeredIds.add(options[0].id);
    stats.offeredIds.add(options[1].id);
    if (stats.pair1Categories === null) {
      stats.pair1Categories = [options[0].category, options[1].category];
    }

    const ctx = buildContext(history);
    const score0 = scoreOption(candidates, guess, options[0].id, ctx, chosenSoFar);
    const score1 = scoreOption(candidates, guess, options[1].id, ctx, chosenSoFar);

    // Greedy: lower expected remaining wins. Tie → first offered (index 0).
    const pickedIdx: 0 | 1 =
      score0.expectedRemaining <= score1.expectedRemaining ? 0 : 1;
    const pick = options[pickedIdx];
    const other = options[1 - pickedIdx];
    const pickedScore = pickedIdx === 0 ? score0 : score1;
    const otherScore = pickedIdx === 0 ? score1 : score0;

    if (stats.pair1PickedCategory === null) {
      stats.pair1PickedCategory = pick.category;
    }

    // Resolve the picked clue. clueReuse swaps in the best-prior clue's
    // compute; extraLock returns its flat result and the candidate set
    // is unchanged.
    let appliedClue: Clue;
    let appliedClueId: ClueId;
    if (pick.id === "clueReuse" && pickedScore.reusedId) {
      appliedClueId = pickedScore.reusedId;
      appliedClue = getClueById(appliedClueId);
    } else if (pick.id === "clueReuse") {
      // No prior clue to reuse — fall back to extraLock's empty result.
      // The AI shouldn't reach this in a well-formed game, but the deck
      // can still offer clueReuse on an early round if the curated
      // protections relax (they don't — but defense in depth).
      appliedClueId = "extraLock";
      appliedClue = getClueById("extraLock");
    } else {
      appliedClueId = pick.id;
      appliedClue = pick;
    }

    const result = appliedClue.compute(guess, target, ctx);
    const before = candidates.length;
    if (pick.id === "extraLock") {
      // No filter; candidate set unchanged.
    } else {
      candidates = filterByResult(candidates, guess, appliedClueId, result, ctx);
    }
    const after = candidates.length;
    const bits = Math.log2(Math.max(1, before) / Math.max(1, after));

    stats.cluePicks.push(pick.id);
    history.push({ guess, clueId: pick.id, result });

    stats.decisions.push({
      round: stats.decisions.length + 1,
      pickedId: pick.id,
      otherId: other.id,
      pickedReusedId: pickedScore.reusedId,
      otherReusedId: otherScore.reusedId,
      pickedExp: pickedScore.expectedRemaining,
      otherExp: otherScore.expectedRemaining,
      bitsGained: bits,
      candidatesBefore: before,
      candidatesAfter: after,
    });
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

function median(arr: readonly number[]): number {
  if (arr.length === 0) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function quartile(arr: readonly number[], q: number): number {
  if (arr.length === 0) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  const idx = Math.max(
    0,
    Math.min(s.length - 1, Math.floor(q * (s.length - 1))),
  );
  return s[idx];
}

function bar(n: number, max: number, width = 40): string {
  if (max <= 0) return "";
  return "█".repeat(Math.round((n / max) * width));
}

// ---------------------------------------------------------------------------
// Main test (gated on RUN_SIM=1, set by `pnpm sim`)
// ---------------------------------------------------------------------------

const runSim = process.env.RUN_SIM === "1";

describe.skipIf(!runSim)("player-chooser simulation", () => {
  it(
    "5-digit Regular mode, AI picks one of two offered clues each round",
    { timeout: 600_000 },
    () => {
      const N = Number(process.env.SIM_N ?? 2000);
      const BUDGET = Number(process.env.SIM_BUDGET ?? 8);

      console.log(
        `\nSimulating ${N} games  digits=5  budget=${BUDGET}  mode=Regular  strategy=greedy info-gain`,
      );
      console.log(
        `Candidate pool after degenerate filter: ${ALL.length} / ${10 ** DIGITS}`,
      );

      const games: SimStats[] = [];
      const offeredCount = new Map<ClueId, number>();
      const pickCount = new Map<ClueId, number>();
      const bitsPerPick = new Map<ClueId, number[]>();
      // Round-when-picked histogram: clueId → array of round indices.
      const roundsPickedAt = new Map<ClueId, number[]>();
      // For clueReuse picks, sub-attribution to the actually-reused id.
      const reuseAppliedTo = new Map<ClueId, number>();
      // Sequence counter (first 3 picks).
      const seq3Count = new Map<string, number>();

      for (let i = 0; i < N; i++) {
        const date = `sim-${i}`;
        const target = generateDailyTarget(date, DIGITS);
        const r = playOne(target, date, BUDGET);
        games.push(r);
        for (const id of r.offeredIds) {
          offeredCount.set(id, (offeredCount.get(id) ?? 0) + 1);
        }
        for (const d of r.decisions) {
          pickCount.set(d.pickedId, (pickCount.get(d.pickedId) ?? 0) + 1);
          const arr = bitsPerPick.get(d.pickedId) ?? [];
          arr.push(d.bitsGained);
          bitsPerPick.set(d.pickedId, arr);
          const rs = roundsPickedAt.get(d.pickedId) ?? [];
          rs.push(d.round);
          roundsPickedAt.set(d.pickedId, rs);
          if (d.pickedId === "clueReuse" && d.pickedReusedId) {
            reuseAppliedTo.set(
              d.pickedReusedId,
              (reuseAppliedTo.get(d.pickedReusedId) ?? 0) + 1,
            );
          }
        }
        const seq = r.cluePicks.slice(0, 3).join(" → ");
        if (seq.length > 0) {
          seq3Count.set(seq, (seq3Count.get(seq) ?? 0) + 1);
        }
      }

      // ---- Headline: histogram + win rate ------------------------------
      const wins = games.filter((g) => g.won);
      const dist: Record<number, number> = {};
      for (const g of wins) dist[g.guessCount] = (dist[g.guessCount] ?? 0) + 1;
      const losses = N - wins.length;
      const meanWins =
        wins.length === 0
          ? 0
          : wins.reduce((s, g) => s + g.guessCount, 0) / wins.length;

      console.log("\n=== HISTOGRAM (guess count to win; ✕ = lost) ===");
      console.log(`win rate: ${((wins.length / N) * 100).toFixed(1)}%   mean (wins): ${meanWins.toFixed(2)}`);
      const maxBucket = Math.max(...Object.values(dist), losses, 1);
      for (let k = 1; k <= BUDGET; k++) {
        const n = dist[k] ?? 0;
        const pct = ((n / N) * 100).toFixed(1).padStart(5);
        console.log(
          `  ${k}: ${String(n).padStart(5)}  ${pct}%  ${bar(n, maxBucket)}`,
        );
      }
      console.log(
        `  ✕: ${String(losses).padStart(5)}  ${((losses / N) * 100).toFixed(1).padStart(5)}%  ${bar(losses, maxBucket)}`,
      );

      // ---- Per-clue table ---------------------------------------------
      console.log("\n=== PER-CLUE TABLE (sorted by avg bits per pick) ===");
      console.log(
        "  CAT NAME              OFFERED  PICK%   PICKS  AVGBITS  MEDBITS  TOTBITS  META",
      );
      const tableRows = CLUES.map((c) => {
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

      for (const r of tableRows) {
        const cat =
          r.category === "positional"
            ? "P"
            : r.category === "compositional"
              ? "C"
              : "S";
        const offeredPct = `${((r.offered / N) * 100).toFixed(0)}%`.padStart(6);
        const pickPct = `${(r.pickRate * 100).toFixed(1)}%`.padStart(6);
        console.log(
          `  [${cat}] ${r.name.padEnd(16)} ${offeredPct}  ${pickPct}  ${String(r.picks).padStart(5)}  ${r.avgBits.toFixed(2).padStart(6)}  ${r.medBits.toFixed(2).padStart(6)}  ${r.totBits.toFixed(0).padStart(6)}  ${r.meta ? "META" : ""}`,
        );
      }

      // ---- Pair-1 composition -----------------------------------------
      let p1_2P = 0,
        p1_1P = 0,
        p1_0P = 0;
      let p1Mixed = 0,
        p1MixedPickedP = 0;
      for (const g of games) {
        if (!g.pair1Categories) continue;
        const ps = g.pair1Categories.filter((c) => c === "positional").length;
        if (ps === 2) p1_2P++;
        else if (ps === 1) {
          p1_1P++;
          p1Mixed++;
          if (g.pair1PickedCategory === "positional") p1MixedPickedP++;
        } else p1_0P++;
      }
      console.log("\n=== PAIR-1 COMPOSITION (curated round-1 set in effect) ===");
      console.log(
        `  2 positional  : ${p1_2P} / ${N}  (${((p1_2P / N) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  1 positional  : ${p1_1P} / ${N}  (${((p1_1P / N) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  0 positional  : ${p1_0P} / ${N}  (${((p1_0P / N) * 100).toFixed(1)}%)`,
      );
      if (p1Mixed > 0) {
        console.log(
          `  on mixed pair 1 (1P+1other), AI picked the positional in ${p1MixedPickedP} / ${p1Mixed}  (${((p1MixedPickedP / p1Mixed) * 100).toFixed(1)}%)`,
        );
      }

      // ---- Per-round mean bits gained ---------------------------------
      console.log("\n=== INFO-GAIN BY ROUND (mean bits gained on the pick) ===");
      const roundBits = new Map<number, number[]>();
      for (const g of games) {
        for (const d of g.decisions) {
          const arr = roundBits.get(d.round) ?? [];
          arr.push(d.bitsGained);
          roundBits.set(d.round, arr);
        }
      }
      const maxRound = Math.max(...roundBits.keys(), 1);
      for (let r = 1; r <= maxRound; r++) {
        const arr = roundBits.get(r) ?? [];
        if (arr.length === 0) continue;
        const m = arr.reduce((s, x) => s + x, 0) / arr.length;
        const med = median(arr);
        console.log(
          `  round ${r}: n=${String(arr.length).padStart(5)}  mean=${m.toFixed(2)}  median=${med.toFixed(2)}  ${bar(Math.round(m * 5), 100, 30)}`,
        );
      }

      // ---- Round-when-picked per clue ---------------------------------
      console.log("\n=== ROUND-WHEN-PICKED HISTOGRAM (per clue, top 10 by total picks) ===");
      const ridSorted = [...CLUES]
        .map((c) => ({
          id: c.id,
          name: c.name,
          rounds: roundsPickedAt.get(c.id) ?? [],
        }))
        .sort((a, b) => b.rounds.length - a.rounds.length)
        .slice(0, 10);
      for (const row of ridSorted) {
        if (row.rounds.length === 0) continue;
        const counts: number[] = new Array(BUDGET + 1).fill(0);
        for (const r of row.rounds) counts[r] = (counts[r] ?? 0) + 1;
        const segs = counts
          .map((n, i) =>
            n > 0 ? `r${i}:${n}` : null,
          )
          .filter((v): v is string => v !== null && !v.startsWith("r0:"));
        console.log(
          `  ${row.name.padEnd(16)} (${row.rounds.length} picks):  ${segs.join("  ")}`,
        );
      }

      // ---- Top first-3 pick sequences ---------------------------------
      console.log("\n=== TOP FIRST-3 PICK SEQUENCES ===");
      const seqs = [...seq3Count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      for (const [seq, n] of seqs) {
        const pct = ((n / N) * 100).toFixed(1);
        console.log(`  ${String(n).padStart(4)}  ${pct.padStart(5)}%   ${seq}`);
      }

      // ---- clueReuse sub-attribution ----------------------------------
      const reuseRows = [...reuseAppliedTo.entries()].sort(
        (a, b) => b[1] - a[1],
      );
      if (reuseRows.length > 0) {
        console.log("\n=== clueReuse SUB-ATTRIBUTION (which clue the AI re-applied) ===");
        for (const [id, n] of reuseRows) {
          console.log(
            `  ${getClueById(id).name.padEnd(16)} ${String(n).padStart(5)}`,
          );
        }
      }

      // ---- Over/underpowered verdict (info clues only) ----------------
      const infoRows = tableRows.filter(
        (r) => !r.meta && (r.picks > 0 || r.offered > 0),
      );
      const bitsArr = infoRows.map((r) => r.avgBits);
      const pickRateArr = infoRows.map((r) => r.pickRate);
      const bitsHi = quartile(bitsArr, 0.75);
      const bitsLo = quartile(bitsArr, 0.25);
      const pickHi = quartile(pickRateArr, 0.75);
      const pickLo = quartile(pickRateArr, 0.25);

      const overpowered = infoRows.filter(
        (r) => r.avgBits >= bitsHi && r.pickRate >= pickHi,
      );
      const underpowered = infoRows.filter(
        (r) => r.avgBits <= bitsLo && r.pickRate <= pickLo,
      );
      console.log("\n=== EMPIRICAL VERDICT (info clues only — meta cards excluded) ===");
      console.log(
        `  thresholds: avg-bits  Q1=${bitsLo.toFixed(2)}  Q3=${bitsHi.toFixed(2)};  pick-rate  Q1=${(pickLo * 100).toFixed(1)}%  Q3=${(pickHi * 100).toFixed(1)}%`,
      );
      console.log("  OVERPOWERED (top quartile on BOTH avg bits and pick rate):");
      if (overpowered.length === 0) console.log("    (none)");
      for (const r of overpowered) {
        console.log(
          `    ${r.name.padEnd(16)}  avgBits=${r.avgBits.toFixed(2)}  pickRate=${(r.pickRate * 100).toFixed(1)}%`,
        );
      }
      console.log("  UNDERPOWERED (bottom quartile on BOTH avg bits and pick rate):");
      if (underpowered.length === 0) console.log("    (none)");
      for (const r of underpowered) {
        console.log(
          `    ${r.name.padEnd(16)}  avgBits=${r.avgBits.toFixed(2)}  pickRate=${(r.pickRate * 100).toFixed(1)}%`,
        );
      }
      console.log(
        "  meta cards (extraLock, clueReuse): skipped — value comes from the lock economy, which the greedy AI does not model.",
      );

      // Sanity: not 0% wins, not 100% wins.
      expect(wins.length / N).toBeGreaterThan(0.05);
      expect(wins.length / N).toBeLessThan(0.999);
    },
  );
});
