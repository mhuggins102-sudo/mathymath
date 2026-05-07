import type { ClueId, ClueResult } from "@/lib/game/clues/types";
import type { DeductionPuzzle } from "./puzzles";
import puzzlesV1 from "@/scripts/captured-puzzles.json";
import puzzlesV2 from "@/scripts/captured-puzzles-v2.json";

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
      return {
        ...g,
        result: {
          kind: "containsDigit",
          picks: [
            { digit: r.digit as number, present: r.present as boolean },
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
