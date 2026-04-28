import type { Clue, ClueId, ClueResult } from "./clues/types";
import { CLUES, getClueById } from "./clues/registry";
import { seededRng } from "./seededRng";

/** Positional clue ids — derived from the registry so adding a new
 *  positional clue automatically participates in advanced-mode rules. */
export const POSITIONAL_CLUE_IDS: ReadonlySet<ClueId> = new Set(
  CLUES.filter((c) => c.category === "positional").map((c) => c.id),
);

export function isPositionalClueId(id: string | undefined): boolean {
  if (!id) return false;
  return POSITIONAL_CLUE_IDS.has(id as ClueId);
}

/** Advanced-mode positional cap. Two positional picks (in any
 *  combination — direct or via Clue Reuse) lock out positional cards
 *  for the rest of the game. */
export const ADVANCED_POSITIONAL_CAP = 2;

interface PositionalAccountingGuess {
  clueId?: string;
  result?: { kind?: string } | unknown;
}

/** Counts how many of the player's resolved guesses count as positional
 *  picks for advanced-mode purposes:
 *    - direct positional pick (clueId is in POSITIONAL_CLUE_IDS), OR
 *    - Clue Reuse pick whose result.kind is positional (i.e. the player
 *      reused a positional clue).
 *  Clue Reuse on a non-positional clue does NOT count. */
export function countEffectivePositionalUses(
  history: readonly PositionalAccountingGuess[],
): number {
  let n = 0;
  for (const g of history) {
    if (isPositionalClueId(g.clueId)) {
      n++;
      continue;
    }
    if (g.clueId === "clueReuse" && g.result && typeof g.result === "object") {
      const r = g.result as { kind?: string };
      if (isPositionalClueId(r.kind)) n++;
    }
  }
  return n;
}

/** Returns the set of positional clue ids that have been "used" so far —
 *  either picked directly or reused via Clue Reuse. Used to filter the
 *  Clue-Reuse picker's pool in advanced mode (so a positional clue that
 *  was previously used can't be re-applied once the cap is reached). */
export function effectiveUsedPositionalIds(
  history: readonly PositionalAccountingGuess[],
): ReadonlySet<ClueId> {
  const out = new Set<ClueId>();
  for (const g of history) {
    if (isPositionalClueId(g.clueId)) {
      out.add(g.clueId as ClueId);
      continue;
    }
    if (g.clueId === "clueReuse" && g.result && typeof g.result === "object") {
      const r = g.result as { kind?: string };
      if (isPositionalClueId(r.kind)) out.add(r.kind as ClueId);
    }
  }
  return out;
}

/** True iff advanced-mode rules apply AND the positional cap has been
 *  reached — meaning future pairs must omit positional cards and the
 *  Clue-Reuse pool must exclude positional clues. */
export function advancedPositionalCapReached(
  advancedMode: boolean,
  history: readonly PositionalAccountingGuess[],
): boolean {
  if (!advancedMode) return false;
  return countEffectivePositionalUses(history) >= ADVANCED_POSITIONAL_CAP;
}

/**
 * Deterministic deck for one game, built from the seed.
 *
 * Standard scheme (`deck_1p1c`, chosen by sim head-to-head over the
 * prior weighted selector):
 *   - Top two cards of the deck are exactly 1 positional + 1
 *     non-positional (compositional or special), shuffled within the
 *     pair. Pair 1 is always a category-contrast decision.
 *   - The rest of the deck is the remaining 5 positional + 10
 *     non-positional, shuffled together.
 *
 * Advanced scheme (`deck_full_shuffle`, used when the player toggles
 * Advanced unlimited mode):
 *   - The full clue roster (minus Clue Reuse) is shuffled freely, so
 *     pair 1 may end up positional/positional, comp/comp, or any other
 *     mix — the category-contrast guarantee is dropped.
 *   - Clue Reuse is still excluded from pair 1 (no previously-used
 *     clues to reuse on round 1) and slotted into the post-pair-1 deck
 *     before that section is shuffled.
 *
 * Both schemes share the "discard offered-but-unpicked" rule: a pair is
 * read at positions k*2 / k*2+1 and never returned to the pool. The
 * advanced scheme uses a different RNG namespace (`deckFullShuffle:`)
 * so toggling Advanced mid-game-prep yields a structurally distinct
 * order rather than a permutation of the standard deck.
 */
function buildDeck(seed: string, advancedMode: boolean = false): ClueId[] {
  const clueReuseId = CLUES.find((c) => c.id === "clueReuse")?.id;

  if (advancedMode) {
    const allExceptReuse = CLUES.filter((c) => c.id !== "clueReuse").map(
      (c) => c.id,
    );
    const rngTop = seededRng(`deckFullShuffle:top:${seed}`);
    const shuffled = fisherYates(allExceptReuse, rngTop);
    const pair1 = shuffled.slice(0, 2);
    const rngRest = seededRng(`deckFullShuffle:rest:${seed}`);
    const rest = fisherYates(
      [...shuffled.slice(2), ...(clueReuseId ? [clueReuseId] : [])],
      rngRest,
    );
    return [...pair1, ...rest];
  }

  const positional = CLUES.filter((c) => c.category === "positional");
  // Clue Reuse is excluded from the top pair (pair 1) because there
  // are no previously-used clues to reuse on round 1. It's pushed
  // into the "rest" section so it can appear from round 2 onward.
  const otherForPair1 = CLUES.filter(
    (c) => c.category !== "positional" && c.id !== "clueReuse",
  );

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
 *
 * `advancedMode` switches to the fully-shuffled deck variant (no
 * pair-1 category-contrast guarantee). It must be threaded through on
 * every call within a single game so the deck stays consistent across
 * rounds.
 *
 * Eligibility filter: cards that fail `isEligible` (locked-out
 * positional after the cap; Clue Reuse on round 1) are skipped past —
 * the deck pointer leapfrogs them. The skipped cards are effectively
 * discarded for the rest of the game, but downstream offsets remain
 * the same, so subsequent rounds are deterministic from the seed.
 *
 * Round-1 Clue Reuse exclusion: pair 1 of the standard deck already
 * lacks Clue Reuse (the buildDeck "rest" section is where it lives),
 * but a redraw on round 1 walks into "rest" where Clue Reuse may sit,
 * which previously surfaced it before the player had any used clues to
 * re-apply. The eligibility check here suppresses that on every
 * round-1 draw regardless of redraws.
 */
export function pickTwoClues(
  seed: string,
  chosenClueIds: readonly ClueId[],
  deckOffset: number = 0,
  excludePositional: boolean = false,
  advancedMode: boolean = false,
): [Clue, Clue] {
  const deck = buildDeck(seed, advancedMode);
  const base = (chosenClueIds.length + deckOffset) * 2;
  const isRound1 = chosenClueIds.length === 0;

  const isEligible = (id: ClueId): boolean => {
    if (excludePositional && isPositionalClueId(id)) return false;
    if (isRound1 && id === "clueReuse") return false;
    return true;
  };

  // Fast path: when both base/base+1 cards pass the filter, take them
  // directly. Preserves the existing offset semantics for the common
  // case (no positional cap, not round 1, or round 1 with no redraw).
  const headA = deck[base];
  const headB = deck[base + 1];
  if (
    headA !== undefined &&
    headB !== undefined &&
    isEligible(headA) &&
    isEligible(headB)
  ) {
    return [getClueById(headA), getClueById(headB)];
  }

  // Otherwise walk the deck from base, taking the next two eligible
  // cards.
  const eligible: ClueId[] = [];
  for (let i = base; i < deck.length; i++) {
    if (isEligible(deck[i])) eligible.push(deck[i]);
    if (eligible.length === 2) break;
  }
  if (eligible.length < 2) {
    // Pathological end-of-deck: backfill from the eligible pool
    // anywhere in the deck. Player should never realistically reach
    // this in a 7-guess game (the deck has plenty of non-positional
    // non-reuse cards), but the function must always return a valid
    // pair.
    const backfill = deck.filter(isEligible);
    while (eligible.length < 2 && backfill.length > 0) {
      eligible.push(backfill[backfill.length - eligible.length - 1]);
    }
  }
  return [getClueById(eligible[0]), getClueById(eligible[1])];
}
