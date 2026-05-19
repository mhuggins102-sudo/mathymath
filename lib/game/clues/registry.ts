import type { Clue, ClueId } from "./types";
import { bullseyesClue } from "./bullseyes";
import { higherLowerClue } from "./higherLower";
import { within2Clue } from "./within2";
import { parityMaskClue } from "./parityMask";
import { oracleClue } from "./oracle";
import { thermometerClue } from "./thermometer";
import { sumDeltaClue } from "./sumDelta";
import { digitOverlapClue } from "./digitOverlap";
import { statSummaryClue } from "./statSummary";
import { digitClassClue } from "./digitClass";
import { containsDigitClue } from "./containsDigit";
import { distinctDigitsClue } from "./distinctDigits";
import { divisibleByClue } from "./divisibleBy";
import { totalDeviationClue } from "./totalDeviation";
import { upsAndDownsClue } from "./upsAndDowns";
import { bullseyeTrendClue } from "./bullseyeTrend";
import { eliminationClue } from "./elimination";
import { extraLockClue } from "./extraLock";
import { clueReuseClue } from "./clueReuse";

// Retired 2026-04-15 (see full-review doc):
//   - sumDirectionClue — strictly dominated by sumDeltaClue (direction-only
//     is a lossy subset of the signed delta).
//   - maxDigitClue — overlaps rangeCompareClue (range = max − min); range
//     encodes max-info plus more, so retiring max and keeping range wins.
// Retired 2026-05-08:
//   - The original count-style Digit Overlap (just the multiset-
//     intersection size) was strictly dominated by Echo (same algorithm,
//     mask vs. count). Echo was renamed to Digit Overlap and the count-
//     style clue dropped.
// Retired 2026-05-10 (low empirical info per pick under greedy-AI sim):
//   - medianClue, rangeCompareClue → merged into statSummaryClue
//     (one card returns both medianCmp and rangeCmp; box-and-whisker feel).
//   - parityBalanceClue, primeCountClue, diceCountClue → merged into
//     digitClassClue (one card returns evenCmp, primeCmp, diceCmp).
// totalDeviationClue was briefly retired (overlaps thermometer) but put
// back: the collapsed-to-a-number feel is different from thermometer's
// per-slot heat grid and the chooser rhythm benefits from having it.
// Retired 2026-05-19:
//   - extraLockClue → bonus-lock semantics moved onto the three
//     compositional clues that needed reweighting (distinctDigits,
//     upsAndDowns, divisibleBy). The Extra Lock card itself is no longer
//     dealt, but its definition stays alive in the legacy map below so
//     getClueById("extraLock") keeps working for replays of older daily
//     histories.
export const CLUES: readonly Clue[] = [
  bullseyesClue,
  higherLowerClue,
  within2Clue,
  parityMaskClue,
  oracleClue,
  thermometerClue,
  sumDeltaClue,
  digitOverlapClue,
  statSummaryClue,
  digitClassClue,
  containsDigitClue,
  distinctDigitsClue,
  divisibleByClue,
  totalDeviationClue,
  upsAndDownsClue,
  bullseyeTrendClue,
  eliminationClue,
  clueReuseClue,
] as const;

/** Clues retired from the deck but still resolvable by id so legacy
 *  history blobs (captured before the retirement) can be replayed. */
const RETIRED_CLUES: readonly Clue[] = [extraLockClue] as const;

const CLUE_BY_ID = new Map<ClueId, Clue>(
  [...CLUES, ...RETIRED_CLUES].map((c) => [c.id, c]),
);

export function getClueById(id: ClueId): Clue {
  const c = CLUE_BY_ID.get(id);
  if (!c) throw new Error(`Unknown clue id: ${id}`);
  return c;
}
