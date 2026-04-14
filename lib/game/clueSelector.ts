import type { Clue } from "./clues/types";
import { CLUES } from "./clues/registry";
import { seededRng, weightedSample } from "./seededRng";

/**
 * Picks two distinct clue options for the given seed + guess index.
 * Deterministic: same inputs always produce the same pair (and order).
 */
export function pickTwoClues(seed: string, guessIndex: number): [Clue, Clue] {
  const rng = seededRng(`clues:${seed}:${guessIndex}`);
  const weights = CLUES.map((c) => c.weight);
  const [a, b] = weightedSample(CLUES, weights, 2, rng);
  return [a, b];
}
