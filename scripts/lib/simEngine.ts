/**
 * Shared simulation primitives used by both the baseline greedy sim
 * (scripts/sim.test.ts) and the strategic-AI sim (scripts/strategicSim.test.ts).
 *
 * The functions here are pure — no game-loop state, just candidate
 * filtering, result keying, and information-gain scoring. Game-loop
 * concerns (lock budget, deck offset, redraw decisions, category
 * preference) live in scripts/strategicAI.ts so each sim variant can
 * import what it needs.
 */
import { getClueById } from "@/lib/game/clues/registry";
import { knownSlotsFromHistory } from "@/lib/game/certain";
import { isDegenerateTarget } from "@/lib/game/targetGenerator";
import type {
  ClueId,
  ClueResult,
  ClueComputeContext,
} from "@/lib/game/clues/types";

export interface SimHistoryEntry {
  guess: string;
  clueId: ClueId;
  result: ClueResult;
  /** Locks placed on this guess in the sim, with their per-slot
   *  correctness resolved. Propagated through `deriveCertainDigits`
   *  so the next round's certain-set reflects prior reveals + correct
   *  locks. Mirrors the real game's lock semantics. */
  locks?: readonly { slot: number; digit: string; correct: boolean }[];
}

/** Enumerate every non-degenerate target of the given digit count. */
export function allCandidates(digits: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 10 ** digits; i++) {
    const s = String(i).padStart(digits, "0");
    if (!isDegenerateTarget(s)) out.push(s);
  }
  return out;
}

/**
 * Collapse a ClueResult to a string key so candidates can be bucketed
 * by "produces the same result against this guess". Bucket sizes drive
 * the greedy info heuristic and the post-result candidate filter.
 */
export function resultKey(r: ClueResult): string {
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

/** Build a ClueComputeContext from sim history — same shape the real
 *  state machine produces via knownSlotsFromHistory. */
export function buildContext(
  history: readonly SimHistoryEntry[],
  digits: number,
): ClueComputeContext {
  const knownSlots = knownSlotsFromHistory(history, digits);
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
export function expectedRemainingForClue(
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

export interface ReuseScore {
  reusedId: ClueId | null;
  expectedRemaining: number;
}

/** Models clueReuse: pick the prior clue that, applied to the current
 *  guess, minimizes expected remaining candidates. With no priors,
 *  reuse is information-empty (returns N). */
export function scoreClueReuse(
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

/** Filter candidates against an observed result. */
export function filterByResult(
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

/**
 * Per-slot digit distribution across the remaining candidate set.
 * Returns an array of length `digits`, each entry a length-10 array
 * counting how many candidates have each digit at that slot. Used by
 * the strategic AI to find lock-worthy slots: a slot whose top digit
 * covers a high fraction of the candidate set is a safe lock.
 */
export function slotDigitDistribution(
  candidates: readonly string[],
  digits: number,
): number[][] {
  const dist: number[][] = Array.from({ length: digits }, () =>
    new Array<number>(10).fill(0),
  );
  for (const c of candidates) {
    for (let i = 0; i < digits; i++) {
      const d = c.charCodeAt(i) - 48;
      dist[i][d] += 1;
    }
  }
  return dist;
}

/** For a slot's digit distribution, return the {digit, fraction} of the
 *  most common digit. Used as the "lock confidence" signal. */
export function topDigitForSlot(
  slotDist: readonly number[],
  total: number,
): { digit: number; fraction: number } {
  if (total <= 0) return { digit: 0, fraction: 0 };
  let bestDigit = 0;
  let bestCount = -1;
  for (let d = 0; d < 10; d++) {
    if (slotDist[d] > bestCount) {
      bestCount = slotDist[d];
      bestDigit = d;
    }
  }
  return { digit: bestDigit, fraction: bestCount / total };
}
