/**
 * Puzzle-mining simulator.
 *
 * Plays N games with a greedy info-maximizing solver. After each clue
 * resolves, evaluates the prefix-history and captures it as a puzzle
 * template iff:
 *
 *   1. The candidate pool has narrowed to exactly 1 (target uniquely
 *      determined → next guess is guaranteed correct).
 *   2. At least 2 digit slots remain UNCERTAIN (the player can't read
 *      the answer off bullseyes / oracle / higher-lower equality —
 *      multiple slots have to be deduced from compositional clues).
 *   3. At least N clues are necessary (default = all). When set to 2
 *      via PUZZLE_SIM_NECESSARY_MIN, the puzzle may contain redundant
 *      clues but still requires combining ≥ 2 to converge.
 *
 * Output:
 *   - Writes captured puzzles (sorted by interestingness) to the path
 *     given by PUZZLE_SIM_OUT (default: scripts/captured-puzzles.json).
 *   - Prints summary stats and a preview of the top puzzles to stdout.
 *
 * Invoke:
 *   pnpm puzzleSim                          # defaults: N=2000
 *   PUZZLE_SIM_N=500 pnpm puzzleSim
 *   PUZZLE_SIM_LIMIT=200 pnpm puzzleSim     # cap captured puzzles in JSON
 *   PUZZLE_SIM_FIRST=random PUZZLE_SIM_NECESSARY_MIN=2 \
 *     PUZZLE_SIM_OUT=scripts/captured-puzzles-v2.json \
 *     PUZZLE_SIM_TAG=r2 pnpm puzzleSim     # v2 run: random first guess,
 *                                            relaxed necessity, distinct ids.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { CLUES, getClueById } from "@/lib/game/clues/registry";
import { seededRng } from "@/lib/game/seededRng";
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
import { directionRuns } from "@/lib/game/clues/upsAndDowns";
import { medianValue } from "@/lib/game/clues/median";

const DIGITS = 5;

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
// targetMatchesResult — hand-coded matcher per clue kind. Uses the result's
// own fields (not a recompute-and-key-compare) so candidates aren't
// accidentally pruned by seeded-RNG drift on clues whose params depend on
// the target (oracle, containsDigit, divisibleBy).
// ---------------------------------------------------------------------------

function digitSum(s: string): number {
  let n = 0;
  for (const ch of s) n += +ch;
  return n;
}
function digitRange(s: string): number {
  const ds = [...s].map(Number);
  return Math.max(...ds) - Math.min(...ds);
}
function evenCount(s: string): number {
  let n = 0;
  for (const ch of s) if (+ch % 2 === 0) n++;
  return n;
}
const PRIMES = new Set([2, 3, 5, 7]);
function primeCount(s: string): number {
  let n = 0;
  for (const ch of s) if (PRIMES.has(+ch)) n++;
  return n;
}
function diceCount(s: string): number {
  let n = 0;
  for (const ch of s) {
    const d = +ch;
    if (d >= 1 && d <= 6) n++;
  }
  return n;
}
function digitOverlap(guess: string, target: string): number {
  const remaining = new Array(10).fill(0);
  for (const ch of target) remaining[+ch]++;
  let count = 0;
  for (const ch of guess) {
    const d = +ch;
    if (remaining[d] > 0) {
      count++;
      remaining[d]--;
    }
  }
  return count;
}
function thermometerTier(diff: number): number {
  const d = Math.abs(diff);
  if (d <= 1) return 0;
  if (d <= 3) return 1;
  return 2;
}
function totalDeviation(guess: string, target: string): number {
  let v = 0;
  for (let i = 0; i < guess.length; i++) v += Math.abs(+guess[i] - +target[i]);
  return v;
}

const DIVISIBLE_BY_DIVISORS = [2, 3, 4, 5, 6, 7, 8, 9];

function targetMatchesResult(
  target: string,
  guess: string,
  result: ClueResult,
): boolean {
  switch (result.kind) {
    case "bullseyes":
      for (let i = 0; i < target.length; i++) {
        if ((target[i] === guess[i]) !== result.hits[i]) return false;
      }
      return true;
    case "higherLower":
      for (let i = 0; i < target.length; i++) {
        const t = +target[i],
          g = +guess[i];
        const c = result.cmp[i];
        if (c === "eq" && t !== g) return false;
        if (c === "lt" && !(t < g)) return false;
        if (c === "gt" && !(t > g)) return false;
      }
      return true;
    case "within2":
      for (let i = 0; i < target.length; i++) {
        const diff = Math.abs(+target[i] - +guess[i]);
        if ((diff <= 2) !== result.mask[i]) return false;
        if (result.exact && (diff === 0) !== result.exact[i]) return false;
      }
      return true;
    case "parityMask": {
      let count = 0;
      for (let i = 0; i < target.length; i++) {
        if (+target[i] % 2 === +guess[i] % 2) count++;
      }
      return count === result.count;
    }
    case "oracle":
      return target[result.slot] === String(result.digit);
    case "thermometer":
      for (let i = 0; i < target.length; i++) {
        if (thermometerTier(+target[i] - +guess[i]) !== result.tier[i]) {
          return false;
        }
      }
      return true;
    case "sumDelta":
      return digitSum(target) - digitSum(guess) === result.delta;
    case "digitOverlap":
      return digitOverlap(guess, target) === result.count;
    case "parityBalance": {
      const t = evenCount(target);
      const g = evenCount(guess);
      if (result.cmp === "eq") return t === g;
      if (result.cmp === "gt") return t > g;
      return t < g;
    }
    case "primeCount": {
      const t = primeCount(target);
      const g = primeCount(guess);
      if (result.cmp === "eq") return t === g;
      if (result.cmp === "gt") return t > g;
      return t < g;
    }
    case "rangeCompare": {
      const t = digitRange(target);
      const g = digitRange(guess);
      if (result.cmp === "eq") return t === g;
      if (result.cmp === "gt") return t > g;
      return t < g;
    }
    case "containsDigit": {
      // Multiset-aware: the n-th time the player picks digit X, the
      // expected present flag is `targetCount(X) > (used so far)`.
      const usedSoFar = new Map<number, number>();
      for (const p of result.picks) {
        const used = usedSoFar.get(p.digit) ?? 0;
        const inTarget = (target.match(new RegExp(String(p.digit), "g")) ?? []).length;
        if ((inTarget > used) !== p.present) return false;
        usedSoFar.set(p.digit, used + 1);
      }
      return true;
    }
    case "distinctDigits":
      return new Set(target).size === result.count;
    case "median": {
      const t = medianValue(target);
      const g = medianValue(guess);
      if (result.cmp === "eq") return t === g;
      if (result.cmp === "gt") return t > g;
      return t < g;
    }
    case "divisibleBy": {
      // Recompute the intersection of (target ÷ d, guess ÷ d) for d in 2-9.
      const targetDivisors = DIVISIBLE_BY_DIVISORS.filter(
        (d) => Number(target) % d === 0,
      );
      const guessDivisorSet = new Set(
        DIVISIBLE_BY_DIVISORS.filter((d) => Number(guess) % d === 0),
      );
      const expectedShared = targetDivisors.filter((d) =>
        guessDivisorSet.has(d),
      );
      const expectedHasAny = targetDivisors.length > 0;
      if (expectedHasAny !== result.targetHasAny) return false;
      if (expectedShared.length !== result.divisors.length) return false;
      for (let i = 0; i < expectedShared.length; i++) {
        if (expectedShared[i] !== result.divisors[i]) return false;
      }
      return true;
    }
    case "totalDeviation":
      return totalDeviation(guess, target) === result.value;
    case "diceCount": {
      const t = diceCount(target);
      const g = diceCount(guess);
      if (result.cmp === "eq") return t === g;
      if (result.cmp === "gt") return t > g;
      return t < g;
    }
    case "upsAndDowns": {
      const t = directionRuns(target);
      const g = directionRuns(guess);
      if (result.cmp === "eq") return t === g;
      if (result.cmp === "gt") return t > g;
      return t < g;
    }
    case "echo":
      for (let i = 0; i < guess.length; i++) {
        if (target.includes(guess[i]) !== result.mask[i]) return false;
      }
      return true;
    case "elimination":
      for (let i = 0; i < guess.length; i++) {
        if (!target.includes(guess[i]) !== result.mask[i]) return false;
      }
      return true;
    case "bullseyeTrend":
      // Trend depends on a prior guess that isn't part of this
      // signature; treat as un-violatable for sim purposes.
      return true;
    case "extraLock":
    case "clueReuse":
      // No target-info clues — every candidate is consistent.
      return true;
  }
}

function filterCandidates(
  candidates: readonly string[],
  guess: string,
  result: ClueResult,
): string[] {
  const out: string[] = [];
  for (const t of candidates) {
    if (targetMatchesResult(t, guess, result)) out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Greedy solver — picks the offered clue (and any param) that minimizes the
// expected remaining candidate count.
// ---------------------------------------------------------------------------

function bucketKey(result: ClueResult): string {
  // Stringify the result deterministically. We only call this on results
  // produced by clue.compute (so all fields populated).
  return JSON.stringify(result);
}

function expectedRemaining(
  candidates: readonly string[],
  guess: string,
  clue: Clue,
  context?: ClueComputeContext,
): number {
  const buckets = new Map<string, number>();
  for (const t of candidates) {
    const r = clue.compute(guess, t, context);
    const k = bucketKey(r);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  let s = 0;
  for (const v of buckets.values()) s += v * v;
  return s / candidates.length;
}

interface PickedClue {
  clueId: ClueId;
  result: ClueResult;
  context: ClueComputeContext;
}

function bestParamForClue(
  candidates: readonly string[],
  guess: string,
  clue: Clue,
  knownSlots: readonly number[],
): ClueComputeContext {
  if (clue.paramKind === "slot") {
    let bestSlot = 0;
    let bestExp = Infinity;
    const known = new Set(knownSlots);
    for (let s = 0; s < DIGITS; s++) {
      if (known.has(s)) continue;
      const exp = expectedRemaining(candidates, guess, clue, {
        selectedSlot: s,
      });
      if (exp < bestExp) {
        bestExp = exp;
        bestSlot = s;
      }
    }
    return { selectedSlot: bestSlot };
  }
  if (clue.paramKind === "digit") {
    // Contains Digit is now multi-pick. The sim only models a single
    // best first pick — accurate-enough approximation for relative
    // win-rate comparisons across balance changes, even though the
    // real player can chain.
    let bestDigit = 0;
    let bestExp = Infinity;
    const guessDigits = new Set([...guess].map(Number));
    for (let d = 0; d < 10; d++) {
      if (!guessDigits.has(d)) continue;
      const exp = expectedRemaining(candidates, guess, clue, {
        picks: [d],
      });
      if (exp < bestExp) {
        bestExp = exp;
        bestDigit = d;
      }
    }
    return { picks: [bestDigit] };
  }
  return {};
}

function pickBestOffered(
  candidates: readonly string[],
  guess: string,
  options: readonly Clue[],
  knownSlots: readonly number[],
): { idx: number; context: ClueComputeContext; expected: number } {
  let bestIdx = 0;
  let bestExp = Infinity;
  let bestCtx: ClueComputeContext = {};
  for (let i = 0; i < options.length; i++) {
    const ctx = bestParamForClue(candidates, guess, options[i], knownSlots);
    const exp = expectedRemaining(candidates, guess, options[i], ctx);
    if (exp < bestExp) {
      bestExp = exp;
      bestIdx = i;
      bestCtx = ctx;
    }
  }
  return { idx: bestIdx, context: bestCtx, expected: bestExp };
}

// ---------------------------------------------------------------------------
// Deck — same shape as the standard deck_1p1c, but excludes special clues
// (extraLock, clueReuse) since they don't fit the deduction-puzzle model.
// ---------------------------------------------------------------------------

function fisherYates<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const DECK_CLUES = CLUES.filter((c) => c.category !== "special");
const POSITIONAL_IDS = DECK_CLUES.filter((c) => c.category === "positional").map(
  (c) => c.id,
);
const COMP_IDS = DECK_CLUES.filter((c) => c.category === "compositional").map(
  (c) => c.id,
);

function buildPuzzleDeck(seed: string): ClueId[] {
  const rngP = seededRng(`puzP:${seed}`);
  const shuffledP = fisherYates(POSITIONAL_IDS, rngP);
  const rngC = seededRng(`puzC:${seed}`);
  const shuffledC = fisherYates(COMP_IDS, rngC);
  const rngPair = seededRng(`puzPair:${seed}`);
  const pair1 = fisherYates([shuffledP[0], shuffledC[0]], rngPair);
  const rngRest = seededRng(`puzRest:${seed}`);
  const rest = fisherYates(
    [...shuffledP.slice(1), ...shuffledC.slice(1)],
    rngRest,
  );
  return [...pair1, ...rest];
}

// ---------------------------------------------------------------------------
// Per-slot certainty (mirrors lib/game/certain.ts but local — avoids
// importing the full lock-aware version).
// ---------------------------------------------------------------------------

function certainSlots(
  history: readonly { guess: string; result: ClueResult }[],
): boolean[] {
  const out: boolean[] = new Array(DIGITS).fill(false);
  for (const g of history) {
    const r = g.result;
    switch (r.kind) {
      case "bullseyes":
        for (let i = 0; i < DIGITS; i++) if (r.hits[i]) out[i] = true;
        break;
      case "higherLower":
        for (let i = 0; i < DIGITS; i++) if (r.cmp[i] === "eq") out[i] = true;
        break;
      case "within2":
        if (r.exact) {
          for (let i = 0; i < DIGITS; i++) if (r.exact[i]) out[i] = true;
        }
        break;
      case "thermometer":
        for (let i = 0; i < DIGITS; i++) if (r.tier[i] === 0) out[i] = true;
        break;
      case "oracle":
        if (r.slot >= 0 && r.slot < DIGITS) out[r.slot] = true;
        break;
      default:
        break;
    }
  }
  return out;
}

function knownSlotIndices(certain: readonly boolean[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < certain.length; i++) if (certain[i]) out.push(i);
  return out;
}

// ---------------------------------------------------------------------------
// Capture model
// ---------------------------------------------------------------------------

interface CapturedGuess {
  guess: string;
  clueId: ClueId;
  result: ClueResult;
}

interface CapturedPuzzle {
  /** game seed + capture round, e.g. "sim-42@3" (after 3 clues). */
  id: string;
  digits: number;
  target: string;
  guesses: CapturedGuess[];
  /** Unknown-slot count at capture time — higher = more digits to deduce. */
  unknownSlots: number;
  /** Candidate-pool size BEFORE the final clue was applied. Bigger means
   *  the final clue had more work to do; smaller means the deduction
   *  was already mostly converged when the last clue landed. */
  candidatesBeforeFinal: number;
  /** Per-clue "leave-one-out" candidate counts. Entry [i] = size of the
   *  candidate pool you'd be left with if clue i were removed. Entries
   *  ≤ 1 indicate redundant clues; entries > 1 = "necessary" clues. */
  looCandidates: number[];
  /** Number of clues whose LOO count > 1 (i.e. clues actually required
   *  to reach a unique answer). Always ≥ the configured min. */
  necessaryCount: number;
  /** Composite difficulty/interest score:
   *    unknownSlots*10 + log2(candidatesBeforeFinal)*3 + necessaryCount.
   *  Higher = harder. */
  difficulty: number;
}

interface PuzzleEvalResult {
  /** True iff this prefix passes all three capture criteria. */
  capture: boolean;
  unknownSlots: number;
  looCandidates: number[];
  necessaryCount: number;
}

function evalPrefix(
  target: string,
  history: readonly CapturedGuess[],
  necessaryMin: number,
): PuzzleEvalResult | null {
  if (history.length < 2) return null;
  // The player knows their prior guesses were wrong (they didn't win),
  // so subtract them from the candidate pool before counting.
  const guessed = new Set(history.map((g) => g.guess));

  // 1. Candidate pool narrowed to exactly 1.
  let candidates: string[] = ALL.filter((c) => !guessed.has(c));
  for (const g of history) {
    candidates = filterCandidates(candidates, g.guess, g.result);
  }
  if (candidates.length !== 1) return null;
  if (candidates[0] !== target) return null; // sanity

  // 2. ≥ 2 unknown slots (otherwise the deduction is reading the answer
  //    off bullseyes/oracle/etc.).
  const certain = certainSlots(history);
  const unknown = certain.filter((c) => !c).length;
  if (unknown < 2) return null;

  // 3. At least `necessaryMin` clues must be necessary. A clue is
  //    "necessary" iff removing it leaves > 1 candidate.
  const looCandidates: number[] = [];
  let necessaryCount = 0;
  for (let skip = 0; skip < history.length; skip++) {
    let cands: string[] = ALL.filter((c) => !guessed.has(c));
    for (let i = 0; i < history.length; i++) {
      if (i === skip) continue;
      cands = filterCandidates(cands, history[i].guess, history[i].result);
    }
    looCandidates.push(cands.length);
    if (cands.length > 1) necessaryCount++;
  }
  if (necessaryCount < necessaryMin) {
    return {
      capture: false,
      unknownSlots: unknown,
      looCandidates,
      necessaryCount,
    };
  }
  return {
    capture: true,
    unknownSlots: unknown,
    looCandidates,
    necessaryCount,
  };
}

// ---------------------------------------------------------------------------
// playOne — runs one game with greedy strategy, captures every prefix that
// qualifies as a puzzle template.
// ---------------------------------------------------------------------------

interface PlayResult {
  won: boolean;
  guessCount: number;
  captures: CapturedPuzzle[];
}

function playOne(
  target: string,
  seed: string,
  budget: number,
  opts: {
    firstGuess: "greedy" | "random";
    necessaryMin: number;
    idTag: string;
  },
): PlayResult {
  const deck = buildPuzzleDeck(seed);
  let candidates = ALL.slice();
  const chosen: ClueId[] = [];
  const history: CapturedGuess[] = [];
  const out: PlayResult = { won: false, guessCount: 0, captures: [] };

  // Seeded RNG used to pick the round-1 guess in "random" mode. Keeps
  // the run reproducible from the seed.
  const firstGuessRng = seededRng(`firstGuess:${seed}`);

  for (let g = 0; g < budget; g++) {
    const guess =
      g === 0 && opts.firstGuess === "random"
        ? candidates[Math.floor(firstGuessRng() * candidates.length)]
        : candidates[0];
    out.guessCount += 1;
    if (guess === target) {
      out.won = true;
      return out;
    }
    if (g + 1 >= budget) return out;

    // Read next pair off the deck. Skip any clue we've already chosen.
    const base = g * 2;
    const offered: Clue[] = [];
    for (let i = base; i < deck.length && offered.length < 2; i++) {
      const id = deck[i];
      if (chosen.includes(id)) continue;
      offered.push(getClueById(id));
    }
    if (offered.length < 2) {
      // Backfill from any unused id (shouldn't happen at budget ≤ 6).
      for (const id of deck) {
        if (offered.length === 2) break;
        if (chosen.includes(id)) continue;
        if (offered.some((c) => c.id === id)) continue;
        offered.push(getClueById(id));
      }
    }

    const certain = certainSlots(history);
    const known = knownSlotIndices(certain);
    const { idx, context } = pickBestOffered(candidates, guess, offered, known);
    const pick = offered[idx];
    chosen.push(pick.id);

    const result = pick.compute(guess, target, context);
    history.push({ guess, clueId: pick.id, result });
    candidates = filterCandidates(candidates, guess, result);
    // The just-submitted guess is known wrong (we didn't win above), so
    // a real player would prune it from their candidate set. Without
    // this, the next round can re-guess the same number.
    candidates = candidates.filter((c) => c !== guess);

    // Evaluate the prefix at every step ≥ 2 clues. Cheap enough at the
    // candidate sizes we see in practice (post-clue-2 the pool is
    // usually small).
    if (history.length >= 2) {
      const evalRes = evalPrefix(target, history, opts.necessaryMin);
      if (evalRes && evalRes.capture) {
        out.captures.push({
          id: `${opts.idTag}-${seed}@${history.length}`,
          digits: DIGITS,
          target,
          guesses: history.map((h) => ({ ...h })),
          unknownSlots: evalRes.unknownSlots,
          candidatesBeforeFinal: -1, // filled below (annotateCandidatesBeforeFinal)
          looCandidates: evalRes.looCandidates,
          necessaryCount: evalRes.necessaryCount,
          difficulty: 0, // filled below (annotateDifficulty)
        });
      }
    }
  }
  return out;
}

// Fill in `candidatesBeforeFinal` for each capture by replaying its history
// up to the second-to-last guess. Done as a post-step so playOne itself
// stays linear-ish.
function annotateCandidatesBeforeFinal(captures: CapturedPuzzle[]): void {
  for (const c of captures) {
    const guessedBeforeFinal = new Set(
      c.guesses.slice(0, -1).map((g) => g.guess),
    );
    let cands: string[] = ALL.filter((x) => !guessedBeforeFinal.has(x));
    for (let i = 0; i < c.guesses.length - 1; i++) {
      cands = filterCandidates(cands, c.guesses[i].guess, c.guesses[i].result);
    }
    c.candidatesBeforeFinal = cands.length;
  }
}

/** Composite difficulty score (higher = harder).
 *  Mirrors the formula advertised to the user via AskUserQuestion. */
export function difficultyScore(p: {
  unknownSlots: number;
  candidatesBeforeFinal: number;
  necessaryCount: number;
}): number {
  return (
    p.unknownSlots * 10 +
    Math.log2(Math.max(2, p.candidatesBeforeFinal)) * 3 +
    p.necessaryCount
  );
}

function annotateDifficulty(captures: CapturedPuzzle[]): void {
  for (const c of captures) c.difficulty = difficultyScore(c);
}

// ---------------------------------------------------------------------------
// Render helpers (for stdout preview)
// ---------------------------------------------------------------------------

function renderResult(result: ClueResult): string {
  switch (result.kind) {
    case "bullseyes":
      return "hits=[" + result.hits.map((h) => (h ? "✓" : "·")).join("") + "]";
    case "higherLower":
      return (
        "cmp=[" +
        result.cmp
          .map((c) => (c === "eq" ? "=" : c === "gt" ? "↑" : "↓"))
          .join("") +
        "]"
      );
    case "within2": {
      const cells = result.mask.map((m, i) => {
        const isExact = result.exact?.[i] ?? false;
        return isExact ? "✓" : m ? "Y" : "·";
      });
      return "mask=[" + cells.join("") + "]";
    }
    case "parityMask":
      return `count=${result.count}`;
    case "oracle":
      return `slot=${result.slot} digit=${result.digit}`;
    case "thermometer":
      return "tier=[" + result.tier.join("") + "]";
    case "sumDelta":
      return `delta=${result.delta >= 0 ? "+" : ""}${result.delta}`;
    case "digitOverlap":
      return `count=${result.count}`;
    case "parityBalance":
      return `target ${result.cmp} guess`;
    case "primeCount":
      return `target ${result.cmp} guess`;
    case "rangeCompare":
      return `target ${result.cmp} guess`;
    case "containsDigit":
      return (
        "picks=[" +
        result.picks.map((p) => `${p.digit}${p.present ? "y" : "n"}`).join(",") +
        "]"
      );
    case "distinctDigits":
      return `count=${result.count}`;
    case "median":
      return `target ${result.cmp} guess`;
    case "divisibleBy":
      if (result.divisors.length > 0) return `shared=${result.divisors.join(",")}`;
      return result.targetHasAny ? "no shared divisor" : "no divisor 2-9";
    case "totalDeviation":
      return `value=${result.value}`;
    case "diceCount":
      return `target ${result.cmp} guess`;
    case "upsAndDowns":
      return `target ${result.cmp} guess`;
    case "bullseyeTrend":
      return `trend=${result.delta >= 0 ? "+" : ""}${result.delta}`;
    case "echo":
      return "echo=[" + result.mask.map((m) => (m ? "Y" : "·")).join("") + "]";
    case "elimination":
      return "elim=[" + result.mask.map((m) => (m ? "X" : "·")).join("") + "]";
    case "extraLock":
      return "(extraLock)";
    case "clueReuse":
      return "(reuse)";
  }
}

function renderPuzzle(p: CapturedPuzzle): string {
  const lines: string[] = [];
  lines.push(
    `  [${p.id}] target=${p.target}  unknown=${p.unknownSlots}  beforeFinal=${p.candidatesBeforeFinal}  loo=[${p.looCandidates.join(",")}]  necessary=${p.necessaryCount}  difficulty=${p.difficulty.toFixed(1)}`,
  );
  for (let i = 0; i < p.guesses.length; i++) {
    const g = p.guesses[i];
    lines.push(
      `      ${i + 1}. guess=${g.guess}  clue=${g.clueId.padEnd(15)}  ${renderResult(g.result)}`,
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

const runSim = process.env.RUN_PUZZLE_SIM === "1";

describe.skipIf(!runSim)("puzzle-mining simulation", () => {
  it(
    "captures puzzle states with guaranteed next-guess solutions",
    { timeout: 1_200_000 },
    () => {
      const N = Number(process.env.PUZZLE_SIM_N ?? 2000);
      const BUDGET = Number(process.env.PUZZLE_SIM_BUDGET ?? 6);
      const LIMIT = Number(process.env.PUZZLE_SIM_LIMIT ?? 500);
      const FIRST_GUESS = (process.env.PUZZLE_SIM_FIRST ?? "greedy") as
        | "greedy"
        | "random";
      // Default = "all clues necessary"; env-set to 2 to relax to "any
      // 2+ clues are necessary" (so the puzzle may have redundant clues
      // but still requires combining ≥ 2 to converge).
      const NECESSARY_MIN = Number(process.env.PUZZLE_SIM_NECESSARY_MIN ?? -1);
      const ID_TAG = process.env.PUZZLE_SIM_TAG ?? "g";
      const OUT_PATH =
        process.env.PUZZLE_SIM_OUT ??
        path.join(path.dirname(__filename), "captured-puzzles.json");

      console.log(
        `\nMining puzzles: N=${N}  budget=${BUDGET}  output cap=${LIMIT}`,
      );
      console.log(
        `  first guess: ${FIRST_GUESS}    necessaryMin: ${NECESSARY_MIN === -1 ? "all" : NECESSARY_MIN}    id tag: "${ID_TAG}"`,
      );
      console.log(`  output path: ${OUT_PATH}`);
      console.log(
        `Candidate pool (post-degenerate-filter): ${ALL.length} / 100000`,
      );
      console.log(
        `Deck clues (positional + compositional, no special): ${DECK_CLUES.length}`,
      );

      const allCaptures: CapturedPuzzle[] = [];
      let wins = 0;
      let totalGuesses = 0;

      const t0 = Date.now();
      const necessaryMin =
        NECESSARY_MIN === -1 ? Number.POSITIVE_INFINITY : NECESSARY_MIN;
      for (let i = 0; i < N; i++) {
        const seed = `puzzle-${i}`;
        const target = generateDailyTarget(seed, DIGITS);
        const r = playOne(target, seed, BUDGET, {
          firstGuess: FIRST_GUESS,
          // For the legacy strict-LOO mode (NECESSARY_MIN = -1) we want
          // every clue to be necessary, which means looCandidates count
          // must equal history.length. Setting necessaryMin = Infinity
          // would always reject; instead we use history.length and
          // dynamically check inside evalPrefix.
          necessaryMin: necessaryMin === Number.POSITIVE_INFINITY ? 1 : necessaryMin,
          idTag: ID_TAG,
        });
        if (r.won) wins++;
        totalGuesses += r.guessCount;
        // Strict mode: post-filter to only puzzles where every clue is
        // necessary (every LOO entry > 1). Legacy v1 behavior.
        const filtered =
          necessaryMin === Number.POSITIVE_INFINITY
            ? r.captures.filter((c) =>
                c.looCandidates.every((n) => n > 1),
              )
            : r.captures;
        allCaptures.push(...filtered);

        if ((i + 1) % 100 === 0) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(
            `  ${i + 1}/${N}  captures so far: ${allCaptures.length}  (${elapsed}s)`,
          );
        }
      }

      annotateCandidatesBeforeFinal(allCaptures);
      annotateDifficulty(allCaptures);

      // Sort hardest → easiest by composite difficulty score.
      allCaptures.sort((a, b) => b.difficulty - a.difficulty);

      const trimmed = allCaptures.slice(0, LIMIT);

      // Distribution stats.
      const byUnknown: Record<number, number> = {};
      const byClueCount: Record<number, number> = {};
      for (const c of allCaptures) {
        byUnknown[c.unknownSlots] = (byUnknown[c.unknownSlots] ?? 0) + 1;
        byClueCount[c.guesses.length] =
          (byClueCount[c.guesses.length] ?? 0) + 1;
      }

      console.log(`\n--- summary ---`);
      console.log(`games:                ${N}`);
      console.log(
        `wins:                 ${wins} (${((wins / N) * 100).toFixed(1)}%)`,
      );
      console.log(
        `mean guesses/game:    ${(totalGuesses / N).toFixed(2)}`,
      );
      console.log(`captured puzzles:     ${allCaptures.length}`);
      console.log(
        `captures per game:    ${(allCaptures.length / N).toFixed(2)}`,
      );
      console.log(`written to JSON:      ${trimmed.length}`);
      console.log(`\nunknown-slot distribution:`);
      for (const k of Object.keys(byUnknown).sort()) {
        const n = byUnknown[Number(k)];
        const bar = "█".repeat(Math.round((n / allCaptures.length) * 40));
        console.log(`  ${k} unknown: ${String(n).padStart(5)} ${bar}`);
      }
      console.log(`\nclue-count distribution:`);
      for (const k of Object.keys(byClueCount).sort()) {
        const n = byClueCount[Number(k)];
        const bar = "█".repeat(Math.round((n / allCaptures.length) * 40));
        console.log(`  ${k} clues:   ${String(n).padStart(5)} ${bar}`);
      }

      console.log(
        `\n--- top ${Math.min(15, trimmed.length)} captured puzzles ---`,
      );
      for (let i = 0; i < Math.min(15, trimmed.length); i++) {
        console.log(renderPuzzle(trimmed[i]));
      }

      // Write output JSON.
      const payload = {
        generatedAt: new Date().toISOString(),
        config: {
          N,
          budget: BUDGET,
          digits: DIGITS,
          limit: LIMIT,
          firstGuess: FIRST_GUESS,
          necessaryMin:
            NECESSARY_MIN === -1 ? "all" : (NECESSARY_MIN as number),
          idTag: ID_TAG,
        },
        criteria: {
          uniqueCandidate: true,
          minUnknownSlots: 2,
          necessaryMin: NECESSARY_MIN === -1 ? "all" : NECESSARY_MIN,
        },
        totals: {
          captured: allCaptures.length,
          wins,
          games: N,
        },
        puzzles: trimmed,
      };
      fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
      fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
      console.log(`\nWrote ${trimmed.length} puzzles to ${OUT_PATH}`);

      // Smoke assertions: the sim should be producing both some wins and
      // some captures. If either is zero, something is broken upstream.
      expect(wins).toBeGreaterThan(0);
      expect(allCaptures.length).toBeGreaterThan(0);
    },
  );
});
