import type { Clue } from "./types";

const DIVISORS = [2, 3, 4, 5, 6, 7, 8, 9];

function divisorsOf(numericString: string): number[] {
  const n = Number(numericString);
  return DIVISORS.filter((d) => n % d === 0);
}

/**
 * Reports the 2-9 values that evenly divide BOTH the target and the
 * player's guess. Ties the clue's information to what the player
 * actually entered: a guess with no overlap reveals nothing about
 * the target's divisors beyond "you've ruled some out".
 */
export const divisibleByClue: Clue<{
  kind: "divisibleBy";
  divisors: number[];
  targetHasAny: boolean;
}> = {
  id: "divisibleBy",
  name: "Divisible By",
  category: "compositional",
  description:
    "Lists the 2-9 values that evenly divide both your guess and the target. Says 'no shared' or 'no' when there's no overlap.",
  // Single-line cmp clue. Highest weight in the roster — it's the
  // most-common filler clue, kept that way after the recasting since
  // the new variant still resolves quickly and reads as fun trivia.
  weight: 1.4,
  legend: [
    { state: "match", label: "shared divisor" },
    { state: "cold", label: "no shared divisor" },
  ],
  compute(guess, target) {
    const targetDivisors = divisorsOf(target);
    const guessDivisors = new Set(divisorsOf(guess));
    const divisors = targetDivisors.filter((d) => guessDivisors.has(d));
    return {
      kind: "divisibleBy",
      divisors,
      targetHasAny: targetDivisors.length > 0,
    };
  },
  example(target) {
    const guess = "36090".slice(0, target.length).padEnd(target.length, "3");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    if (result.divisors.length > 0) {
      return `Target and your guess are both evenly divisible by ${result.divisors.join(", ")}.`;
    }
    if (result.targetHasAny) {
      return "Target has 2-9 divisors but none of them divide your guess.";
    }
    return "Target is not evenly divisible by any value from 2 to 9.";
  },
};
