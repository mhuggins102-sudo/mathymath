import type { Clue } from "./types";

/**
 * Contains Digit — interactive multi-pick. The player taps slots in
 * their current guess one at a time. Each pick resolves to one of
 * three states:
 *   - exact (green): the digit at that slot matches the target's
 *     digit at the same slot AND the digit is still "available" in
 *     the remaining target multiset.
 *   - present (yellow): the digit appears somewhere in the remaining
 *     target multiset, just not at this slot.
 *   - absent (red): the digit is not (or no longer) in the remaining
 *     target multiset. The round ends immediately on a red pick.
 *
 * Multiset accounting is strict: a yellow consumes one occurrence of
 * the digit from "remaining," so a later exact-slot pick for the
 * same digit can land red if the player burned the only copy on a
 * mismatched slot earlier.
 */

function digitCounts(s: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const ch of s) {
    const d = Number(ch);
    out.set(d, (out.get(d) ?? 0) + 1);
  }
  return out;
}

export interface ContainsDigitPick {
  slot: number;
  digit: number;
  present: boolean;
  exact: boolean;
}

/** Resolve a sequence of slot picks against the guess and target.
 *  Used by both compute (full pass) and the per-pick callers in the
 *  hook / API endpoint. */
export function resolveContainsDigitPicks(
  guess: string,
  target: string,
  slotPicks: readonly number[],
): ContainsDigitPick[] {
  const remaining = digitCounts(target);
  const out: ContainsDigitPick[] = [];
  for (const slot of slotPicks) {
    const digit = Number(guess[slot]);
    const remainingForDigit = remaining.get(digit) ?? 0;
    if (remainingForDigit > 0) {
      const exact = Number(target[slot]) === digit;
      out.push({ slot, digit, present: true, exact });
      remaining.set(digit, remainingForDigit - 1);
    } else {
      out.push({ slot, digit, present: false, exact: false });
    }
  }
  return out;
}

/** Slots still available to pick: every slot index in [0..guess.length)
 *  minus the slots already picked. Returned in ascending order. */
export function containsDigitAvailableSlots(
  guessLength: number,
  picks: readonly { slot: number }[],
): number[] {
  const used = new Set(picks.map((p) => p.slot));
  const out: number[] = [];
  for (let i = 0; i < guessLength; i++) {
    if (!used.has(i)) out.push(i);
  }
  return out;
}

/** Round-complete check: ends after the first red pick (present=false)
 *  or once every slot in the guess has been picked. */
export function containsDigitRoundComplete(
  guess: string,
  picks: readonly { present: boolean }[],
): boolean {
  if (picks.length === 0) return false;
  if (!picks[picks.length - 1].present) return true;
  return picks.length >= guess.length;
}

export const containsDigitClue: Clue<{
  kind: "containsDigit";
  picks: ContainsDigitPick[];
}> = {
  id: "containsDigit",
  name: "Contains Digit",
  category: "compositional",
  description:
    "Tap a slot in your guess to ask if that digit is in the target. Green = exact-slot match; yellow = digit is in the target but at a different slot; red = digit is not in the target. The round ends on your first red pick.",
  // Multi-pick rounds yield more information per turn than a single
  // yes/no — the slot-aware variant is stronger still since it can
  // surface exact matches. Selector currently ignores `weight`.
  weight: 1.0,
  paramKind: "slot",
  legend: [
    { state: "match", label: "exact match" },
    { state: "warm", label: "digit present" },
    { state: "cold", label: "digit absent" },
  ],
  compute(guess, target, context) {
    const slotPicks = context?.picks ?? [];
    return {
      kind: "containsDigit",
      picks: resolveContainsDigitPicks(guess, target, slotPicks),
    };
  },
  example(target) {
    // Build a guess where slot 0 demos yellow, slot 2 demos green
    // (exact match), and slot 3 demos red (a digit not in target).
    // For the standard help-modal target "47628" this produces a
    // visibly tri-colored row: 8 (yellow) at slot 0, 6 (green) at
    // slot 2, 0 (red) at slot 3. Falls back gracefully for any
    // other target.
    const distinct = Array.from(new Set(target)).map(Number);
    const padDigit = String(distinct[0] ?? 0);
    const buf = new Array(target.length).fill(padDigit);
    if (distinct.length > 0) {
      // Slot 0 — last distinct digit (in target but at a different slot).
      buf[0] = String(distinct[distinct.length - 1]);
    }
    if (target.length > 1 && distinct.length > 1) {
      buf[1] = String(distinct[Math.max(0, distinct.length - 2)]);
    }
    if (target.length > 2) {
      // Slot 2 — exact match.
      buf[2] = target[2];
    }
    if (target.length > 3) {
      // Slot 3 — a digit not in target (red).
      const notInTarget =
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !distinct.includes(d)) ?? 0;
      buf[3] = String(notInTarget);
    }
    const guess = buf.join("");
    const picks = [0, 1, 2, 3].filter((i) => i < target.length);
    return { guess, result: this.compute(guess, target, { picks }) };
  },
  explain(_guess, result) {
    if (result.picks.length === 0) return "No picks yet.";
    const lines = result.picks.map((p) => {
      const slotLabel = `slot ${p.slot + 1}`;
      if (p.exact) return `${slotLabel}: ${p.digit} exact match`;
      if (p.present) return `${slotLabel}: ${p.digit} present`;
      return `${slotLabel}: ${p.digit} absent`;
    });
    return lines.join(" · ");
  },
};
