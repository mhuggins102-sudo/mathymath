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
    guesses: p.guesses.map((g) => ({
      guess: g.guess,
      clueId: g.clueId,
      result: g.result,
    })),
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
