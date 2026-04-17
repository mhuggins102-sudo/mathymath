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
  // Clue Reuse is excluded from the top pair (pair 1) because there
  // are no previously-used clues to reuse on round 1. It's pushed
  // into the "rest" section so it can appear from round 2 onward.
  const otherForPair1 = CLUES.filter(
    (c) => c.category !== "positional" && c.id !== "clueReuse",
  );
  const clueReuseId = CLUES.find((c) => c.id === "clueReuse")?.id;

  const rngP = seededRng(`deck1p1cP:${seed}`);
  const shuffledP = fisherYates(
    positional.map((c) => c.id),
    rngP,
  );
  const rngC = seededRng(`deck1p1cC:${seed}`);
  const shuffledC = fisherYates(
    otherForPair1.map((c) => c.id),
    rngC,
  );

  const rngPair = seededRng(`deck1p1cPair:${seed}`);
  const pair1 = fisherYates([shuffledP[0], shuffledC[0]], rngPair);

  const rngRest = seededRng(`deck1p1cRest:${seed}`);
  const rest = fisherYates(
    [
      ...shuffledP.slice(1),
      ...shuffledC.slice(1),
      ...(clueReuseId ? [clueReuseId] : []),
    ],
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
 * the round. `deckOffset` adds extra positions consumed by redraws
 * (the burn-lock-to-redraw mechanic). In the deck model the pair is
 * simply `deck[(round + offset) * 2]` and `deck[(round + offset) * 2 + 1]`.
 */
export function pickTwoClues(
  seed: string,
  chosenClueIds: readonly ClueId[],
  deckOffset: number = 0,
): [Clue, Clue] {
  const deck = buildDeck(seed);
  const base = (chosenClueIds.length + deckOffset) * 2;
  const aId = deck[base] ?? deck[deck.length - 2];
  const bId = deck[base + 1] ?? deck[deck.length - 1];
  return [getClueById(aId), getClueById(bId)];
}
