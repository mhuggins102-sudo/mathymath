import type { ReactNode } from "react";

export type ClueCategory = "positional" | "compositional";

export type Cmp = "lt" | "eq" | "gt";

export type ClueResult =
  // Positional
  | { kind: "bullseyes"; hits: boolean[] }
  | { kind: "higherLower"; cmp: Cmp[] }
  | { kind: "within2"; mask: boolean[] }
  | { kind: "parityMask"; matches: boolean[] }
  | { kind: "oracle"; slot: number; digit: number }
  | { kind: "thermometer"; tier: number[] } // 0=exact..4=far
  // Compositional
  | { kind: "sumDirection"; cmp: Cmp }
  | { kind: "sumDelta"; delta: number } // target - guess
  | { kind: "digitOverlap"; count: number }
  | { kind: "parityBalance"; match: boolean }
  | { kind: "primeCount"; match: boolean }
  | { kind: "rangeCompare"; cmp: Cmp }
  | { kind: "containsDigit"; digit: number; present: boolean }
  | { kind: "distinctDigits"; count: number }
  | { kind: "maxDigit"; cmp: Cmp };

export type ClueId = ClueResult["kind"];

export interface Clue<R extends ClueResult = ClueResult> {
  id: R["kind"];
  name: string;
  category: ClueCategory;
  description: string;
  weight: number;
  compute(guess: string, target: string): R;
  example(target: string): { guess: string; result: R };
}

// Helper narrowing: given an id, narrow ClueResult.
export type ClueResultFor<K extends ClueId> = Extract<ClueResult, { kind: K }>;

export interface ClueBadgeRendererProps {
  result: ClueResult;
  guess: string;
}

export type ClueBadgeRenderer = (props: ClueBadgeRendererProps) => ReactNode;
