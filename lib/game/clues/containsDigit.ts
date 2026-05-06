import type { Clue, ClueComputeContext } from "./types";

/**
 * Asks whether a specific digit appears in the target. The digit is
 * picked automatically from the player's guess: the first guess digit
 * that hasn't been asked about in a previous Contains Digit pick. If
 * every guess digit has already been asked, fall back to walking
 * 0-9 and picking the first un-asked one.
 *
 * Pure on (guess, priorResults) — the target is never consulted to
 * pick the digit, so the client and the daily validator agree on
 * which digit was queried.
 */
function pickDigit(guess: string, context: ClueComputeContext | undefined): number {
  const askedAbout = new Set<number>();
  for (const r of context?.priorResults ?? []) {
    if (r.kind === "containsDigit") askedAbout.add(r.digit);
  }
  for (const ch of guess) {
    const d = Number(ch);
    if (!askedAbout.has(d)) return d;
  }
  for (let d = 0; d < 10; d++) {
    if (!askedAbout.has(d)) return d;
  }
  // Every digit 0-9 already asked — only reachable past 10 picks,
  // which a 7-guess game can't do. Defensive default.
  return 0;
}

export const containsDigitClue: Clue<{
  kind: "containsDigit";
  digit: number;
  present: boolean;
}> = {
  id: "containsDigit",
  name: "Contains Digit",
  category: "compositional",
  description:
    "Picks a digit FROM your guess and tells you whether it appears anywhere in the target. The picked digit is the first one in your guess that hasn't been asked about before.",
  // Single-bit yes/no clue. Weight kept above neutral so it shows up in
  // the chooser regularly (it's often the finisher late-game), but pulled
  // back from the top after simulations showed it dominating picks.
  weight: 1.2,
  legend: [
    { state: "match", label: "digit present" },
    { state: "cold", label: "digit absent" },
  ],
  compute(guess, target, context) {
    const digit = pickDigit(guess, context);
    const present = target.includes(String(digit));
    return { kind: "containsDigit", digit, present };
  },
  example(target) {
    const guess = "98765".slice(0, target.length).padEnd(target.length, "9");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    return result.present
      ? `The target contains at least one ${result.digit}.`
      : `The target does NOT contain the digit ${result.digit}.`;
  },
};
