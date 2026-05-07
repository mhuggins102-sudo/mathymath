import type { Clue, ClueId } from "./clues/types";
import { CLUES, getClueById } from "./clues/registry";
import { seededRng } from "./seededRng";

/** Positional clue ids — kept around because cell-rendering hints and
 *  some help-modal categorization still distinguish positional vs.
 *  compositional. The advanced-mode "positional cap" mechanic that
 *  previously gated card draws is gone (replaced by a turn-1 curated-
 *  list guarantee for regular mode and a flat full shuffle for
 *  advanced mode). */
export const POSITIONAL_CLUE_IDS: ReadonlySet<ClueId> = new Set(
  CLUES.filter((c) => c.category === "positional").map((c) => c.id),
);

export function isPositionalClueId(id: string | undefined): boolean {
  if (!id) return false;
  return POSITIONAL_CLUE_IDS.has(id as ClueId);
}

/** Curated set of clues from which regular mode (and daily) guarantees
 *  pair 1 contains at least one. Hand-picked for round-1 friendliness:
 *  positional reveals (Higher/Lower, Within 2, Oracle, Thermometer)
 *  and the most legible compositional clues (Echo, Elimination,
 *  Divisible By, Contains Digit). Advanced mode ignores this list. */
export const ROUND1_CURATED_CLUE_IDS: ReadonlySet<ClueId> = new Set<ClueId>([
  "echo",
  "elimination",
  "divisibleBy",
  "containsDigit",
  "higherLower",
  "within2",
  "oracle",
  "thermometer",
]);

/**
 * Deterministic deck for one game, built from the seed.
 *
 * Regular scheme (used by daily and unlimited's regular mode):
 *   - Pair 1 is guaranteed to contain at least one card from
 *     `ROUND1_CURATED_CLUE_IDS`. The other slot is drawn from the
 *     remaining (curated or non-curated, but never round-1-ineligible).
 *   - The rest of the deck is everything else — including Clue Reuse
 *     and Bullseye Trend, which can't appear on round 1 by design —
 *     shuffled freely.
 *
 * Advanced scheme (used by unlimited's advanced mode):
 *   - The full clue roster MINUS Clue Reuse is shuffled freely. No
 *     curated guarantee on pair 1.
 *   - Bullseye Trend is still kept out of pair 1 (needs a prior guess);
 *     it slots into the post-pair-1 section before that shuffle.
 *   - Clue Reuse never appears: advanced players start with 0 locks
 *     and would have nothing to spend on it, so the card is dropped
 *     from the deck entirely rather than offered as an unselectable
 *     option.
 *
 * Both schemes share the "discard offered-but-unpicked" rule: a pair is
 * read at positions k*2 / k*2+1 and never returned to the pool. RNG
 * namespaces differ between schemes so toggling Advanced mid-game-prep
 * yields a structurally distinct order rather than a permutation.
 */

/** Ids that are kept out of pair 1 because they cannot meaningfully
 *  resolve there. Clue Reuse needs a previously-used clue to re-apply,
 *  and Bullseye Trend needs a previously-resolved guess to compare
 *  against — both are impossible on round 1. They go into the rest
 *  deck so they surface from round 2 onward. */
const ROUND1_INELIGIBLE_BY_DESIGN: ReadonlySet<ClueId> = new Set<ClueId>([
  "clueReuse",
  "bullseyeTrend",
]);

function buildDeck(seed: string, advancedMode: boolean = false): ClueId[] {
  if (advancedMode) {
    // Advanced: full shuffle, Clue Reuse removed entirely.
    const allEligible = CLUES.filter(
      (c) => c.id !== "clueReuse" && !ROUND1_INELIGIBLE_BY_DESIGN.has(c.id),
    ).map((c) => c.id);
    const rngTop = seededRng(`deckFullShuffle:top:${seed}`);
    const shuffled = fisherYates(allEligible, rngTop);
    const pair1 = shuffled.slice(0, 2);
    // Bullseye Trend goes into "rest" so it can show from round 2 on.
    // Clue Reuse intentionally excluded everywhere in advanced mode.
    const rngRest = seededRng(`deckFullShuffle:rest:${seed}`);
    const rest = fisherYates(
      [...shuffled.slice(2), "bullseyeTrend" as ClueId],
      rngRest,
    );
    return [...pair1, ...rest];
  }

  // Regular: pair 1 has ≥1 curated. We pick one curated for slot A,
  // then anything pair-1-eligible (curated or other) for slot B.
  const curatedAll = CLUES
    .filter((c) => ROUND1_CURATED_CLUE_IDS.has(c.id))
    .map((c) => c.id);
  const otherPair1Eligible = CLUES
    .filter(
      (c) =>
        !ROUND1_CURATED_CLUE_IDS.has(c.id) &&
        !ROUND1_INELIGIBLE_BY_DESIGN.has(c.id),
    )
    .map((c) => c.id);
  const ineligible = CLUES
    .filter((c) => ROUND1_INELIGIBLE_BY_DESIGN.has(c.id))
    .map((c) => c.id);

  const rngCurated = seededRng(`deckCurated:c:${seed}`);
  const shuffledCurated = fisherYates(curatedAll, rngCurated);
  const rngOther = seededRng(`deckCurated:o:${seed}`);
  const shuffledOther = fisherYates(otherPair1Eligible, rngOther);

  // Slot A: the first curated card. Slot B: the first non-curated
  // pair-1-eligible card (or, if there are no eligible non-curated
  // cards, the second curated). Final pair order randomized so the
  // curated card isn't always on the left.
  const slotA = shuffledCurated[0];
  const slotB = shuffledOther[0] ?? shuffledCurated[1];
  const rngPair = seededRng(`deckCurated:pair:${seed}`);
  const pair1 = fisherYates([slotA, slotB], rngPair);

  const usedInPair = new Set(pair1);
  const rngRest = seededRng(`deckCurated:rest:${seed}`);
  const rest = fisherYates(
    [
      ...curatedAll.filter((id) => !usedInPair.has(id)),
      ...otherPair1Eligible.filter((id) => !usedInPair.has(id)),
      ...ineligible,
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
 * the round. `deckOffset` adds extra positions consumed by redraws.
 * In the deck model the pair is simply `deck[(round + offset) * 2]`
 * and `deck[(round + offset) * 2 + 1]`.
 *
 * `advancedMode` switches to the full-shuffle deck variant (no curated
 * pair-1 guarantee, Clue Reuse removed). Must be threaded through on
 * every call within a single game so the deck stays consistent.
 *
 * Eligibility filter: cards that fail `isEligible` (Clue Reuse or
 * Bullseye Trend on round 1) are skipped past. `excludeIds` is a
 * soft filter: cards in this set are avoided when possible but allowed
 * as a last-resort fallback if the hard-eligible pool runs dry. */
export function pickTwoClues(
  seed: string,
  chosenClueIds: readonly ClueId[],
  deckOffset: number = 0,
  advancedMode: boolean = false,
  excludeIds: ReadonlySet<ClueId> = EMPTY_ID_SET,
): [Clue, Clue] {
  const deck = buildDeck(seed, advancedMode);
  const base = (chosenClueIds.length + deckOffset) * 2;
  const isRound1 = chosenClueIds.length === 0;

  const isEligible = (id: ClueId): boolean => {
    if (isRound1 && id === "clueReuse") return false;
    // Bullseye Trend compares the current guess to the previous guess,
    // so it makes no sense on round 1 where there's no prior guess.
    if (isRound1 && id === "bullseyeTrend") return false;
    return true;
  };
  const isFresh = (id: ClueId): boolean =>
    isEligible(id) && !excludeIds.has(id);

  // Fast path: when both base/base+1 cards are fresh, take them
  // directly. Preserves the existing offset semantics for the common
  // case (no positional cap, not round 1, or round 1 with no redraw).
  const headA = deck[base];
  const headB = deck[base + 1];
  if (
    headA !== undefined &&
    headB !== undefined &&
    isFresh(headA) &&
    isFresh(headB)
  ) {
    return [getClueById(headA), getClueById(headB)];
  }

  // Otherwise walk the deck from base, taking the next two fresh
  // cards. Skipping previously-offered ids here is what stops the
  // walk-forward leak from re-offering them in a later round.
  const fresh: ClueId[] = [];
  for (let i = base; i < deck.length; i++) {
    if (isFresh(deck[i])) fresh.push(deck[i]);
    if (fresh.length === 2) break;
  }
  if (fresh.length === 2) {
    return [getClueById(fresh[0]), getClueById(fresh[1])];
  }

  // Forward walk didn't find two fresh cards. Backfill from the rest
  // of the deck, preferring fresh ids first, then any eligible id as
  // a last-resort (a duplicate is better than throwing — the player
  // should never realistically reach this in a 7-guess game).
  const result: ClueId[] = [...fresh];
  const pushUnique = (id: ClueId): void => {
    if (!result.includes(id)) result.push(id);
  };
  for (const id of deck) {
    if (result.length === 2) break;
    if (isFresh(id)) pushUnique(id);
  }
  for (const id of deck) {
    if (result.length === 2) break;
    if (isEligible(id)) pushUnique(id);
  }
  return [getClueById(result[0]), getClueById(result[1])];
}

const EMPTY_ID_SET: ReadonlySet<ClueId> = new Set();

/**
 * Pre-deals N distinct info clues for "Preselected Clues" mode (one
 * clue per guess except the final one). Special clues — extraLock and
 * clueReuse — are excluded from the pool.
 *
 * Standard mode: slot 0 is drawn from the round-1 curated set; slots
 * 1..N-1 are random non-special. Bullseye Trend may appear at any
 * non-zero slot.
 *
 * Advanced mode: full shuffle, no curated guarantee. If Bullseye Trend
 * lands at slot 0 it's swapped with the first later eligible slot
 * (still round-1-ineligible by design).
 *
 * Determinism: same seed produces the same deck so daily-style fairness
 * holds within a game session.
 */
export function buildPreselectedDeck(
  seed: string,
  count: number,
  advancedMode: boolean,
): ClueId[] {
  const infoClues = CLUES.filter(
    (c) => c.category === "positional" || c.category === "compositional",
  ).map((c) => c.id);

  if (advancedMode) {
    const walk = fisherYates(infoClues, seededRng(`pre:adv:walk:${seed}`));
    const out = walk.slice(0, count);
    const shuffled = fisherYates(out, seededRng(`pre:adv:order:${seed}`));
    if (shuffled.length > 0 && ROUND1_INELIGIBLE_BY_DESIGN.has(shuffled[0])) {
      for (let i = 1; i < shuffled.length; i++) {
        if (!ROUND1_INELIGIBLE_BY_DESIGN.has(shuffled[i])) {
          [shuffled[0], shuffled[i]] = [shuffled[i], shuffled[0]];
          break;
        }
      }
    }
    return shuffled;
  }

  // Regular: slot 0 from the curated round-1 set; remaining slots are
  // any other info clue, shuffled.
  const curated = infoClues.filter((id) => ROUND1_CURATED_CLUE_IDS.has(id));
  const other = infoClues.filter((id) => !ROUND1_CURATED_CLUE_IDS.has(id));
  const shuffledCurated = fisherYates(curated, seededRng(`pre:std:c:${seed}`));
  const slot0 = shuffledCurated[0];
  const rest = fisherYates(
    [...shuffledCurated.slice(1), ...other],
    seededRng(`pre:std:rest:${seed}`),
  );
  return [slot0, ...rest.slice(0, Math.max(0, count - 1))];
}
