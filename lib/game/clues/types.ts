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
  | { kind: "within2"; mask: boolean[]; exact: boolean[] }
  | { kind: "parityMask"; matches: boolean[] }
  | { kind: "oracle"; slot: number; digit: number }
  | { kind: "thermometer"; tier: number[] } // 0=exact..4=far
  // Compositional
  | { kind: "sumDelta"; delta: number } // target - guess
  | { kind: "digitOverlap"; mask: boolean[] }
  | { kind: "statSummary"; medianCmp: Cmp; minCmp: Cmp; maxCmp: Cmp }
  | { kind: "digitClass"; evenCmp: Cmp; primeCmp: Cmp; diceCmp: Cmp }
  | {
      kind: "containsDigit";
      picks: {
        slot: number;
        digit: number;
        /** True when the player's slot digit appears anywhere in the
         *  target (multiset-aware). False for absent picks; round
         *  ends on the first false. */
        present: boolean;
        /** True when the slot's digit also matches the target's digit
         *  AT that slot (exact match). Always false when present is
         *  false. */
        exact: boolean;
      }[];
    }
  | { kind: "distinctDigits"; count: number; sharedRepeated: boolean[] }
  | { kind: "divisibleBy"; divisors: number[]; targetHasAny: boolean }
  | { kind: "totalDeviation"; value: number }
  | { kind: "upsAndDowns"; cmp: Cmp }
  | { kind: "bullseyeTrend"; delta: number }
  | { kind: "elimination"; mask: boolean[] }
  // Special — meta-action cards that don't reveal target info but
  // change game resources. extraLock grants +1 lock (see locks.ts).
  | { kind: "extraLock" }
  // clueReuse: the Clue Reuse special's nominal result kind. In
  // practice the resolved result carries the RE-USED clue's kind
  // (e.g. "thermometer") — this variant exists only to satisfy the
  // Clue<R> constraint where id must equal R["kind"].
  | { kind: "clueReuse" };

export type ClueId = ClueResult["kind"];

/** Optional context passed to `compute` when the caller has more state
 *  than just (guess, target). */
export interface ClueComputeContext {
  /** Indices of slots whose target digit is already known. */
  knownSlots?: readonly number[];
  /** Player-chosen slot. Currently unused — Oracle was the only
   *  consumer and now auto-picks. Field retained for future
   *  positional clues that need explicit slot choice. */
  selectedSlot?: number;
  /** Player-chosen digit for clues with paramKind "digit". Currently
   *  unused — retained for future single-digit clues. */
  selectedDigit?: number;
  /** Player-chosen sequence of slot indices, in order, for Contains
   *  Digit's interactive flow. Each pick reveals whether the digit
   *  at that slot is present in the target (yellow) or matches the
   *  target's digit at the same slot exactly (green); a digit not in
   *  the remaining target multiset ends the round (red). */
  picks?: number[];
  /** Player-chosen previously-used clue to reuse (Clue Reuse special). */
  reusedClueId?: string;
  /** Resolved results from prior guesses, in order. Used by clues that
   *  prefer not to repeat already-revealed information when they're
   *  re-applied (e.g. Divisible By picks a fresh divisor when one is
   *  available). Null entries (from the final lost-guess row) are not
   *  included. */
  priorResults?: readonly ClueResult[];
  /** Player's prior guesses, in order — needed by clues that compare
   *  the current guess to an earlier one (e.g. Bullseye Trend). */
  priorGuesses?: readonly string[];
}

/** The parameter the player chose when a clue requires paramKind.
 *  Serialized into the choose-clue server request and the CHOOSE_CLUE
 *  state-machine action. */
export interface ClueParam {
  selectedSlot?: number;
  selectedDigit?: number;
  picks?: number[];
  reusedClueId?: string;
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
  /** If set, the player must provide a parameter after choosing this
   *  clue — "slot" shows the slot picker (Contains Digit: tap a slot
   *  in your guess to test that digit), "reuse" shows the Clue Reuse
   *  picker. Clues without this resolve immediately when chosen. */
  paramKind?: "slot" | "reuse";
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
