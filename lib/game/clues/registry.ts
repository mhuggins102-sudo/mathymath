import type { Clue, ClueId } from "./types";
import { bullseyesClue } from "./bullseyes";
import { higherLowerClue } from "./higherLower";
import { within2Clue } from "./within2";
import { parityMaskClue } from "./parityMask";
import { oracleClue } from "./oracle";
import { thermometerClue } from "./thermometer";
import { sumDirectionClue } from "./sumDirection";
import { sumDeltaClue } from "./sumDelta";
import { digitOverlapClue } from "./digitOverlap";
import { parityBalanceClue } from "./parityBalance";
import { primeCountClue } from "./primeCount";
import { rangeCompareClue } from "./rangeCompare";
import { containsDigitClue } from "./containsDigit";
import { distinctDigitsClue } from "./distinctDigits";
import { maxDigitClue } from "./maxDigit";
import { medianClue } from "./median";
import { divisibleByClue } from "./divisibleBy";

export const CLUES: readonly Clue[] = [
  bullseyesClue,
  higherLowerClue,
  within2Clue,
  parityMaskClue,
  oracleClue,
  thermometerClue,
  sumDirectionClue,
  sumDeltaClue,
  digitOverlapClue,
  parityBalanceClue,
  primeCountClue,
  rangeCompareClue,
  containsDigitClue,
  distinctDigitsClue,
  maxDigitClue,
  medianClue,
  divisibleByClue,
] as const;

const CLUE_BY_ID = new Map<ClueId, Clue>(CLUES.map((c) => [c.id, c]));

export function getClueById(id: ClueId): Clue {
  const c = CLUE_BY_ID.get(id);
  if (!c) throw new Error(`Unknown clue id: ${id}`);
  return c;
}
