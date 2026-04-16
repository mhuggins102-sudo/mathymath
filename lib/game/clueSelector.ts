import type { Clue, ClueId } from "./clues/types";
import { CLUES, getClueById } from "./clues/registry";
import { seededRng } from "./seededRng";

/**
 * Deterministic deck for one game, built from the seed.
 *
 * Rules (the "deck_1p1c" scheme, chosen by sim head-to-head over the
 * prior weighted selector):
 *   - Top two cards of the deck are exactly 1 positional + 1
 *     non-positional (compositional or special), shuffled within the
 *     pair. Pair 1 is always a category-contrast decision.
 *   - The rest of the deck is the remaining 5 positional + 10
 *     non-positional, shuffled together.
 *   - Cards are drawn two at a time in deck order. Offered-but-
 *     unpicked cards are not returned to the pool — they're discarded
 *     permanently. (This is enforced implicitly: pair k reads positions
 *     k*2 and k*2+1; no clue id ever appears twice in the deck.)
 *
 * Two independent RNGs plus a pair-shuffle RNG keep daily fairness:
 * two players on the same puzzle derive the same deck, so the same
 * pair is always offered at the same round.
 */
function buildDeck(seed: string): ClueId[] {
  const positional = CLUES.filter((c) => c.category === "positional");
  const other = CLUES.filter((c) => c.category !== "positional");

  const rngP = seededRng(`deck1p1cP:${seed}`);
  const shuffledP = fisherYates(
    positional.map((c) => c.id),
    rngP,
  );
  const rngC = seededRng(`deck1p1cC:${seed}`);
  const shuffledC = fisherYates(
    other.map((c) => c.id),
    rngC,
  );

  const rngPair = seededRng(`deck1p1cPair:${seed}`);
  const pair1 = fisherYates([shuffledP[0], shuffledC[0]], rngPair);

  const rngRest = seededRng(`deck1p1cRest:${seed}`);
  const rest = fisherYates(
    [...shuffledP.slice(1), ...shuffledC.slice(1)],
    rngRest,
  );

  return [...pair1, ...rest];
}

function fisherYates<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks two clue options for the current chooser round.
 *
 * The round index is `chosenClueIds.length` — each chosen clue advances
 * the round. In the deck model the pair is simply `deck[round*2]` and
 * `deck[round*2+1]`. `chosenClueIds` is otherwise unused; it's kept in
 * the signature for the rare fallback below and so downstream code
 * doesn't need to change shape.
 *
 * Fallback: with 17 clues and a 7-guess budget we consume at most 12
 * cards (6 chooser rounds × 2), so running off the end shouldn't
 * happen in practice. If somehow it does (e.g. stale client state
 * replay), we return the last two ids rather than crash — the history
 * validator will reject an inconsistent state anyway.
 */
export function pickTwoClues(
  seed: string,
  chosenClueIds: readonly ClueId[],
): [Clue, Clue] {
  const deck = buildDeck(seed);
  const base = chosenClueIds.length * 2;
  const aId = deck[base] ?? deck[deck.length - 2];
  const bId = deck[base + 1] ?? deck[deck.length - 1];
  return [getClueById(aId), getClueById(bId)];
}
