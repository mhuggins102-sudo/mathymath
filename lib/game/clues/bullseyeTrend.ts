import type { Clue, ClueComputeContext } from "./types";

function exactMatchCount(guess: string, target: string): number {
  let n = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) n++;
  }
  return n;
}

function bullseyeDelta(
  guess: string,
  target: string,
  context: ClueComputeContext | undefined,
): number {
  const priorGuess = context?.priorGuesses?.at(-1);
  if (priorGuess === undefined) {
    // Defensive default for round 1; in practice the clue is gated
    // out of round 1 in pickTwoClues so this should never fire.
    return 0;
  }
  return exactMatchCount(guess, target) - exactMatchCount(priorGuess, target);
}

export const bullseyeTrendClue: Clue<{
  kind: "bullseyeTrend";
  delta: number;
}> = {
  id: "bullseyeTrend",
  name: "Bullseye Trend",
  category: "compositional",
  description:
    "Compares the number of exact-slot matches in your current guess to your previous guess. Tells you if you're heading in the right direction. Not offered on round 1 — needs a prior guess to compare against.",
  // Information-theoretically thin (~1.5 bits) but the only clue that
  // explicitly rewards iterative guess construction. Weight kept
  // modest so it's a regular but not dominant draw.
  weight: 0.7,
  legend: [
    { state: "match", label: "more matches than last guess" },
    { state: "idle", label: "same matches" },
    { state: "cold", label: "fewer matches" },
  ],
  compute(guess, target, context) {
    return {
      kind: "bullseyeTrend",
      delta: bullseyeDelta(guess, target, context),
    };
  },
  example(target) {
    // Synthesize a prior guess (all zeros — likely 0 bullseye matches
    // against the help-card target) and a current guess with a couple
    // of exact slots so the example reads "+2 more".
    const prior = "0".repeat(target.length);
    const guess =
      target.slice(0, 2) + "0".repeat(Math.max(0, target.length - 2));
    return { guess, result: this.compute(guess, target, { priorGuesses: [prior] }) };
  },
  explain(_guess, result) {
    if (result.delta > 0)
      return `Your guess has ${result.delta} MORE exact-slot match${result.delta === 1 ? "" : "es"} than your previous guess.`;
    if (result.delta < 0) {
      const n = Math.abs(result.delta);
      return `Your guess has ${n} FEWER exact-slot match${n === 1 ? "" : "es"} than your previous guess.`;
    }
    return "Your guess has the SAME number of exact-slot matches as your previous guess.";
  },
};
