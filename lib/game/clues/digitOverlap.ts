import type { Clue } from "./types";

export const digitOverlapClue: Clue<{ kind: "digitOverlap"; count: number }> = {
  id: "digitOverlap",
  name: "Digit Overlap",
  category: "compositional",
  description:
    "For each digit in your guess, checks whether that digit appears anywhere in the target (any position). Counts the matches — so if you guess 23446 and the target is 44215, the overlap is 3 (both 4s and the 2 all appear in the target).",
  weight: 1.0,
  compute(guess, target) {
    const targetSet = new Set(target);
    let count = 0;
    for (const ch of guess) if (targetSet.has(ch)) count++;
    return { kind: "digitOverlap", count };
  },
  example(target) {
    const guess = "1".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
