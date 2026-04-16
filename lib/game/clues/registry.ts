import type { Clue, ClueId } from "./types";
import { bullseyesClue } from "./bullseyes";
import { higherLowerClue } from "./higherLower";
import { within2Clue } from "./within2";
import { parityMaskClue } from "./parityMask";
import { oracleClue } from "./oracle";
import { thermometerClue } from "./thermometer";
import { sumDeltaClue } from "./sumDelta";
import { digitOverlapClue } from "./digitOverlap";
import { parityBalanceClue } from "./parityBalance";
import { primeCountClue } from "./primeCount";
import { rangeCompareClue } from "./rangeCompare";
import { containsDigitClue } from "./containsDigit";
import { distinctDigitsClue } from "./distinctDigits";
import { medianClue } from "./median";
import { divisibleByClue } from "./divisibleBy";
import { totalDeviationClue } from "./totalDeviation";
import { diceCountClue } from "./diceCount";
import { extraLockClue } from "./extraLock";

// Retired 2026-04-15 (see full-review doc):
//   - sumDirectionClue — strictly dominated by sumDeltaClue (direction-only
//     is a lossy subset of the signed delta).
//   - maxDigitClue — overlaps rangeCompareClue (range = max − min); range
//     encodes max-info plus more, so retiring max and keeping range wins.
// totalDeviationClue was briefly retired (overlaps thermometer) but put
// back: the collapsed-to-a-number feel is different from thermometer's
// per-slot heat grid and the chooser rhythm benefits from having it.
export const CLUES: readonly Clue[] = [
  bullseyesClue,
  higherLowerClue,
  within2Clue,
  parityMaskClue,
  oracleClue,
  thermometerClue,
  sumDeltaClue,
  digitOverlapClue,
  parityBalanceClue,
  primeCountClue,
  rangeCompareClue,
  containsDigitClue,
  distinctDigitsClue,
  medianClue,
  divisibleByClue,
  totalDeviationClue,
  diceCountClue,
  extraLockClue,
] as const;

const CLUE_BY_ID = new Map<ClueId, Clue>(CLUES.map((c) => [c.id, c]));

export function getClueById(id: ClueId): Clue {
  const c = CLUE_BY_ID.get(id);
  if (!c) throw new Error(`Unknown clue id: ${id}`);
  return c;
}
