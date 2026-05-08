import type { Clue } from "./types";

/**
 * Contains Digit — interactive multi-pick. The player picks digits
 * from their current guess, one at a time. Each pick is YES if the
 * target contains at least as many copies of that digit as the player
 * has asked about so far (multiset-aware). The round continues as
 * long as picks are correct and the player still has guess digits
 * left to spend; it ends on the first wrong pick or when the player
 * exhausts their guess multiset.
 */

function digitCounts(s: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const ch of s) {
    const d = Number(ch);
    out.set(d, (out.get(d) ?? 0) + 1);
  }
  return out;
}

/** Resolve a sequence of digit picks against the target into per-pick
 *  yes/no flags. Used by both compute (full pass) and the per-pick
 *  callers in the hook / API endpoint. */
export function resolveContainsDigitPicks(
  target: string,
  picks: readonly number[],
): { digit: number; present: boolean }[] {
  const targetCounts = digitCounts(target);
  const used = new Map<number, number>();
  const out: { digit: number; present: boolean }[] = [];
  for (const digit of picks) {
    const usedSoFar = used.get(digit) ?? 0;
    const inTarget = targetCounts.get(digit) ?? 0;
    out.push({ digit, present: inTarget > usedSoFar });
    used.set(digit, usedSoFar + 1);
  }
  return out;
}

/** Digits still available to pick given the player's guess and the
 *  picks they've already made. Returns distinct digits sorted
 *  ascending — the picker UI uses this list to enable buttons. */
export function containsDigitAvailable(
  guess: string,
  picks: readonly number[],
): number[] {
  const guessCounts = digitCounts(guess);
  const used = new Map<number, number>();
  for (const d of picks) used.set(d, (used.get(d) ?? 0) + 1);
  const available: number[] = [];
  for (const [digit, count] of guessCounts) {
    if ((used.get(digit) ?? 0) < count) available.push(digit);
  }
  available.sort((a, b) => a - b);
  return available;
}

/** Round-complete check: the round ends after a wrong pick, or after
 *  every digit in the player's guess has been asked about. */
export function containsDigitRoundComplete(
  guess: string,
  picks: readonly { digit: number; present: boolean }[],
): boolean {
  if (picks.length === 0) return false;
  if (!picks[picks.length - 1].present) return true;
  const digitsOnly = picks.map((p) => p.digit);
  return containsDigitAvailable(guess, digitsOnly).length === 0;
}

export const containsDigitClue: Clue<{
  kind: "containsDigit";
  picks: { digit: number; present: boolean }[];
}> = {
  id: "containsDigit",
  name: "Contains Digit",
  category: "compositional",
  description:
    "Pick digits from your guess to ask if they're in the target. Keep going while you're correct. The round ends on your first wrong pick or once you've used every guess digit.",
  // Multi-pick rounds yield more information per turn than a single
  // yes/no, so weight stays moderate to keep them showing up.
  weight: 1.2,
  paramKind: "digit",
  legend: [
    { state: "match", label: "digit present" },
    { state: "cold", label: "digit absent" },
  ],
  compute(guess, target, context) {
    const picks = context?.picks ?? [];
    return {
      kind: "containsDigit",
      picks: resolveContainsDigitPicks(target, picks),
    };
  },
  example(target) {
    // Pick the first two distinct digits from the target so the example
    // shows two correct picks. With target "47628" the picks become 4
    // and 7 — both present.
    const distinct: number[] = [];
    for (const ch of target) {
      const d = Number(ch);
      if (!distinct.includes(d)) distinct.push(d);
      if (distinct.length === 2) break;
    }
    const guess = "98765".slice(0, target.length).padEnd(target.length, "9");
    return {
      guess,
      result: this.compute(guess, target, { picks: distinct }),
    };
  },
  explain(_guess, result) {
    if (result.picks.length === 0) return "No picks yet.";
    const lines = result.picks.map(
      (p) => `${p.digit}: ${p.present ? "yes" : "no"}`,
    );
    return lines.join(" · ");
  },
};
