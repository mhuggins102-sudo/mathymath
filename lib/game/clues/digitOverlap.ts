import type { Clue } from "./types";

export const digitOverlapClue: Clue<{ kind: "digitOverlap"; count: number }> = {
  id: "digitOverlap",
  name: "Digit Overlap",
  category: "compositional",
  description:
    "For each digit in your guess, checks whether that digit appears anywhere in the target. Counts the matches.",
  weight: 1.0,
  compute(guess, target) {
    const targetSet = new Set(target);
    let count = 0;
    for (const ch of guess) if (targetSet.has(ch)) count++;
    return { kind: "digitOverlap", count };
  },
  example(target) {
    const guess = "12348".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    return `${result.count} of your ${guess.length} digits appear somewhere in the target.`;
  },
};
