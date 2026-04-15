import type { Clue, ClueId } from "./clues/types";
import { CLUES } from "./clues/registry";
import { seededRng, weightedSample } from "./seededRng";

/**
 * Picks two distinct clue options given the seed and the history of
 * already-chosen clue ids.
 *
 * Determinism: the seed is built from `(seed, sorted set of chosen ids,
 * count)`. Sorting ensures that two players who arrived at the same SET of
 * chosen clues via different orderings see the same next pair — they have
 * the same information, so they deserve the same options. The count is
 * included so each guess index draws fresh randomness even when the sorted
 * set happens to repeat (which it shouldn't, but belt-and-suspenders).
 *
 * Exclusion: clues whose ids appear in `chosenClueIds` are removed from the
 * pool, so no clue type can be offered twice in a single game.
 */
export function pickTwoClues(
  seed: string,
  chosenClueIds: readonly ClueId[],
): [Clue, Clue] {
  const sortedKey = [...chosenClueIds].sort().join(",");
  const rng = seededRng(
    `clues:${seed}:${chosenClueIds.length}:${sortedKey}`,
  );
  const pool: Clue[] = CLUES.filter((c) => !chosenClueIds.includes(c.id));
  if (pool.length < 2) {
    // Shouldn't happen — the roster is larger than the max picks per game.
    // Fall back to the full registry so the reducer always has a pair.
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
