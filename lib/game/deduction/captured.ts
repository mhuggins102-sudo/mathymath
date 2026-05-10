import type { Cmp, ClueId, ClueResult } from "@/lib/game/clues/types";
import type { DeductionPuzzle } from "./puzzles";
import puzzlesV1 from "@/scripts/captured-puzzles.json";
import puzzlesV2 from "@/scripts/captured-puzzles-v2.json";

// Helpers for migrating retired Median / Digit Range / Even Count /
// Prime Count / Dice Count rows into Stat Summary / Digit Class. The
// old rows carry one cmp; the new clues carry two or three. We have
// (guess, target) on the captured puzzle, so we just recompute every
// cmp from scratch — the single old cmp is implicitly correct and
// gets folded into the richer result.
function _medianValue(s: string): number {
  const sorted = [...s].map(Number).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
function _digitRange(s: string): number {
  const ds = [...s].map(Number);
  return Math.max(...ds) - Math.min(...ds);
}
function _evenCount(s: string): number {
  let n = 0;
  for (const ch of s) if (Number(ch) % 2 === 0) n++;
  return n;
}
const _PRIMES = new Set([2, 3, 5, 7]);
function _primeCount(s: string): number {
  let n = 0;
  for (const ch of s) if (_PRIMES.has(Number(ch))) n++;
  return n;
}
function _diceCount(s: string): number {
  let n = 0;
  for (const ch of s) {
    const d = Number(ch);
    if (d >= 1 && d <= 6) n++;
  }
  return n;
}
function _cmpOf(t: number, g: number): Cmp {
  return t === g ? "eq" : t > g ? "gt" : "lt";
}

interface RawGuess {
  guess: string;
  clueId: ClueId;
  result: ClueResult;
}

interface RawPuzzle {
  id: string;
  digits: number;
  target: string;
  guesses: RawGuess[];
  unknownSlots?: number;
  candidatesBeforeFinal?: number;
  looCandidates?: number[];
  necessaryCount?: number;
  difficulty?: number;
}

/** Several clue result shapes were rewritten in the late-2026 balance
 *  pass. Captured puzzles in scripts/captured-puzzles*.json predate
 *  those changes; load-time migration keeps them parseable by the
 *  current explain() / cellStates() functions instead of forcing a
 *  full re-capture. */
function digitOverlapMask(guess: string, target: string): boolean[] {
  const remaining = new Map<string, number>();
  for (const ch of target)
    remaining.set(ch, (remaining.get(ch) ?? 0) + 1);
  return [...guess].map((ch) => {
    const left = remaining.get(ch) ?? 0;
    if (left <= 0) return false;
    remaining.set(ch, left - 1);
    return true;
  });
}

function migrateResult(target: string, g: RawGuess): RawGuess {
  const r = g.result as unknown as Record<string, unknown>;
  // Echo was renamed to Digit Overlap (and the old count-style Digit
  // Overlap was retired). Old captured rows can carry kind: "echo"
  // with a mask, OR kind: "digitOverlap" with just a count. Both map
  // to the new { kind: "digitOverlap", mask: boolean[] } shape.
  // `clueId` is typed as the current ClueId union, which no longer
  // includes "echo" — but stored captured rows can carry it. Widen
  // the comparison to a string check to handle both.
  const cid = g.clueId as string;
  if (cid === "echo" || cid === "digitOverlap") {
    if (
      r.kind === "digitOverlap" &&
      Array.isArray((r as { mask?: unknown }).mask)
    ) {
      return g;
    }
    if (
      (r.kind as string) === "echo" &&
      Array.isArray((r as { mask?: unknown }).mask)
    ) {
      return {
        ...g,
        clueId: "digitOverlap" as ClueId,
        result: { kind: "digitOverlap", mask: r.mask as boolean[] } as ClueResult,
      };
    }
    if (typeof (r as { count?: unknown }).count === "number") {
      return {
        ...g,
        clueId: "digitOverlap" as ClueId,
        result: {
          kind: "digitOverlap",
          mask: digitOverlapMask(g.guess, target),
        } as ClueResult,
      };
    }
  }
  if (g.clueId === "containsDigit") {
    if (Array.isArray((r as { picks?: unknown }).picks)) return g;
    if ("digit" in r && "present" in r) {
      // Legacy single-pick shape from before slot tracking. Synthesize
      // a slot-based pick for compat: slot 0, exact false (the old
      // shape didn't carry exact-position information).
      return {
        ...g,
        result: {
          kind: "containsDigit",
          picks: [
            {
              slot: 0,
              digit: r.digit as number,
              present: r.present as boolean,
              exact: false,
            },
          ],
        } as ClueResult,
      };
    }
  }
  if (g.clueId === "divisibleBy") {
    if (Array.isArray((r as { divisors?: unknown }).divisors)) return g;
    if ("present" in r) {
      const present = r.present as boolean;
      const divisor = r.divisor as number | null | undefined;
      return {
        ...g,
        result: {
          kind: "divisibleBy",
          divisors:
            present && typeof divisor === "number" ? [divisor] : [],
          targetHasAny: present,
        } as ClueResult,
      };
    }
  }
  if (g.clueId === "distinctDigits") {
    if (Array.isArray((r as { sharedRepeated?: unknown }).sharedRepeated))
      return g;
    if (typeof (r as { count?: unknown }).count === "number") {
      const guessCounts = new Map<string, number>();
      for (const ch of g.guess)
        guessCounts.set(ch, (guessCounts.get(ch) ?? 0) + 1);
      const targetCounts = new Map<string, number>();
      for (const ch of target)
        targetCounts.set(ch, (targetCounts.get(ch) ?? 0) + 1);
      const sharedRepeated = [...g.guess].map(
        (ch) =>
          (guessCounts.get(ch) ?? 0) >= 2 &&
          (targetCounts.get(ch) ?? 0) >= 2,
      );
      return {
        ...g,
        result: {
          kind: "distinctDigits",
          count: r.count as number,
          sharedRepeated,
        } as ClueResult,
      };
    }
  }
  // Retired 2026-05-10: Median + Digit Range merged into Stat Summary.
  // Each old row supplies one of the two cmps; we recompute both from
  // (guess, target) and replace.
  const cidStr = g.clueId as string;
  if (cidStr === "median" || cidStr === "rangeCompare") {
    return {
      ...g,
      clueId: "statSummary" as ClueId,
      result: {
        kind: "statSummary",
        medianCmp: _cmpOf(_medianValue(target), _medianValue(g.guess)),
        rangeCmp: _cmpOf(_digitRange(target), _digitRange(g.guess)),
      } as ClueResult,
    };
  }
  // Retired 2026-05-10: Even / Prime / Dice Count merged into Digit Class.
  if (
    cidStr === "parityBalance" ||
    cidStr === "primeCount" ||
    cidStr === "diceCount"
  ) {
    return {
      ...g,
      clueId: "digitClass" as ClueId,
      result: {
        kind: "digitClass",
        evenCmp: _cmpOf(_evenCount(target), _evenCount(g.guess)),
        primeCmp: _cmpOf(_primeCount(target), _primeCount(g.guess)),
        diceCmp: _cmpOf(_diceCount(target), _diceCount(g.guess)),
      } as ClueResult,
    };
  }
  if (g.clueId === "parityMask") {
    if (Array.isArray((r as { matches?: unknown }).matches)) return g;
    if (typeof (r as { count?: unknown }).count === "number") {
      // Mid-2026 the clue was briefly recast as a count-only result.
      // Recompute the per-slot mask from (guess, target) so the
      // restored mask UI has its info back.
      const matches = [...g.guess].map(
        (ch, i) =>
          Number(ch) % 2 === Number(target[i]) % 2,
      );
      return {
        ...g,
        result: { kind: "parityMask", matches } as ClueResult,
      };
    }
  }
  return g;
}

interface RawFile {
  puzzles: RawPuzzle[];
}

/** Composite difficulty score (higher = harder).
 *  Mirrors scripts/puzzleSim.test.ts#difficultyScore so v1 puzzles
 *  (which lack a baked-in `difficulty` field) get a comparable rank. */
function computeDifficulty(p: RawPuzzle): number {
  const unknownSlots = p.unknownSlots ?? 0;
  const candidatesBeforeFinal = p.candidatesBeforeFinal ?? 2;
  // Necessary clue count = entries in looCandidates with > 1 remaining.
  const necessaryCount =
    p.necessaryCount ??
    (p.looCandidates ?? []).filter((n) => n > 1).length ??
    p.guesses.length;
  return (
    unknownSlots * 10 +
    Math.log2(Math.max(2, candidatesBeforeFinal)) * 3 +
    necessaryCount
  );
}

function toDeductionPuzzle(p: RawPuzzle): DeductionPuzzle {
  return {
    id: p.id,
    digits: p.digits,
    target: p.target,
    guesses: p.guesses.map((g) => {
      const migrated = migrateResult(p.target, g);
      return {
        guess: migrated.guess,
        clueId: migrated.clueId,
        result: migrated.result,
      };
    }),
    difficulty: p.difficulty ?? computeDifficulty(p),
  };
}

const RAW_V1 = (puzzlesV1 as RawFile).puzzles ?? [];
const RAW_V2 = (puzzlesV2 as RawFile).puzzles ?? [];

// Merge v1 + v2, dedupe by id (v2's tagged ids generally don't collide,
// but a defensive dedupe keeps things tidy if a future re-run does).
const seenIds = new Set<string>();
const merged: DeductionPuzzle[] = [];
for (const raw of [...RAW_V1, ...RAW_V2]) {
  if (seenIds.has(raw.id)) continue;
  seenIds.add(raw.id);
  merged.push(toDeductionPuzzle(raw));
}

// Sort hardest → easiest.
merged.sort((a, b) => b.difficulty - a.difficulty);

export const CAPTURED_DEDUCTION_PUZZLES: DeductionPuzzle[] = merged;

export type Difficulty = "easy" | "medium" | "hard" | "all";

/** Equal-thirds split by rank: first third (hardest) = Hard, etc.
 *  When the total isn't divisible by 3, the remainder rolls into Medium
 *  so Easy and Hard stay balanced. */
function bucketByThirds(sorted: DeductionPuzzle[]): {
  hard: DeductionPuzzle[];
  medium: DeductionPuzzle[];
  easy: DeductionPuzzle[];
} {
  const n = sorted.length;
  const third = Math.floor(n / 3);
  const hard = sorted.slice(0, third);
  const easy = sorted.slice(n - third);
  const medium = sorted.slice(third, n - third);
  return { hard, medium, easy };
}

const buckets = bucketByThirds(merged);

export const PUZZLES_BY_DIFFICULTY: Record<Difficulty, DeductionPuzzle[]> = {
  hard: buckets.hard,
  medium: buckets.medium,
  easy: buckets.easy,
  all: merged,
};
