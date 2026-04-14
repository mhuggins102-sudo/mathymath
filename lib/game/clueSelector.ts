import type { Clue, ClueId } from "./clues/types";
import { CLUES } from "./clues/registry";
import { seededRng, weightedSample } from "./seededRng";

/**
 * Picks two distinct clue options given the seed and the history of
 * already-chosen clue ids.
 *
 * Determinism: same (seed, chosenClueIds sequence) always yields the same
 * ordered pair. This makes daily puzzles fair — any two players who have
 * taken the same clue path up to guess N see the identical two options on
 * guess N+1.
 *
 * Exclusion: clues whose ids appear in `chosenClueIds` are removed from the
 * pool, so no clue type can be offered twice in a single game.
 */
export function pickTwoClues(
  seed: string,
  chosenClueIds: readonly ClueId[],
): [Clue, Clue] {
  const rng = seededRng(`clues:${seed}:${chosenClueIds.join(",")}`);
  const pool: Clue[] = CLUES.filter((c) => !chosenClueIds.includes(c.id));
  if (pool.length < 2) {
    // Shouldn't happen with 12 clues and <= 10 guesses, but fall back safely
    // by replaying the full registry if somehow exhausted.
    const fallback = CLUES.slice();
    const [a, b] = weightedSample(
      fallback,
      fallback.map((c) => c.weight),
      2,
      rng,
    );
    return [a, b];
  }
  const [a, b] = weightedSample(
    pool,
    pool.map((c) => c.weight),
    2,
    rng,
  );
  return [a, b];
}
