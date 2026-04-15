import type { ReactNode } from "react";

export type ClueCategory = "positional" | "compositional" | "special";

export type Cmp = "lt" | "eq" | "gt";

/** Visual-state labels the UI uses. Kept here so clue files can declare
 *  their own color legends without importing from the components layer. */
export type DigitStateName =
  | "idle"
  | "match"
  | "close"
  | "warm"
  | "cool"
  | "cold"
  | "hint"
  | "entering";

export interface LegendEntry {
  state: DigitStateName;
  label: string;
}

export type ClueResult =
  // Positional
  | { kind: "bullseyes"; hits: boolean[] }
  | { kind: "higherLower"; cmp: Cmp[] }
  | { kind: "within2"; mask: boolean[] }
  | { kind: "parityMask"; matches: boolean[] }
  | { kind: "oracle"; slot: number; digit: number }
  | { kind: "thermometer"; tier: number[] } // 0=exact..4=far
  // Compositional
  | { kind: "sumDelta"; delta: number } // target - guess
  | { kind: "digitOverlap"; count: number }
  | { kind: "parityBalance"; cmp: Cmp }
  | { kind: "primeCount"; cmp: Cmp }
  | { kind: "rangeCompare"; cmp: Cmp }
  | { kind: "containsDigit"; digit: number; present: boolean }
  | { kind: "distinctDigits"; count: number }
  | { kind: "median"; cmp: Cmp }
  | { kind: "divisibleBy"; divisor: number | null; present: boolean }
  | { kind: "totalDeviation"; value: number }
  // Special — meta-action cards that don't reveal target info but
  // change game resources. extraLock grants +1 lock (see locks.ts).
  | { kind: "extraLock" };

export type ClueId = ClueResult["kind"];

/** Optional context passed to `compute` when the caller has more state
 *  than just (guess, target). Today only Oracle uses it — to avoid
 *  re-revealing a slot the player already knows from prior clues or a
 *  correctly-landed lock. Callers that don't supply a context get the
 *  original "any slot" behaviour, so tests and sims don't break. */
export interface ClueComputeContext {
  /** Indices of slots whose target digit is already known. */
  knownSlots?: readonly number[];
}

export interface Clue<R extends ClueResult = ClueResult> {
  id: R["kind"];
  name: string;
  category: ClueCategory;
  description: string;
  weight: number;
  /** Optional color legend. Rendered below the description in Help/Chooser
   *  so color references don't need to live in the description text. */
  legend?: LegendEntry[];
  compute(guess: string, target: string, context?: ClueComputeContext): R;
  example(target: string): { guess: string; result: R };
  /** Plain-language explanation of the result for this specific guess.
   *  Rendered in the in-game popover when a player taps the clue name. */
  explain(guess: string, result: R): string;
}

// Helper narrowing: given an id, narrow ClueResult.
export type ClueResultFor<K extends ClueId> = Extract<ClueResult, { kind: K }>;

export interface ClueBadgeRendererProps {
  result: ClueResult;
  guess: string;
}

export type ClueBadgeRenderer = (props: ClueBadgeRendererProps) => ReactNode;
