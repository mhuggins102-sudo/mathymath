import type { Clue } from "./types";

export const digitOverlapClue: Clue<{ kind: "digitOverlap"; count: number }> = {
  id: "digitOverlap",
  name: "Digit Overlap",
  category: "compositional",
  description:
    "How many of your digits have a match in the target. Duplicates are capped by the target's count — three 2s against a target with only two 2s scores 2, not 3.",
  weight: 0.9,
  compute(guess, target) {
    // Multiset intersection: each digit in the target can match at most
    // one digit in the guess. We tick off matches as we go.
    const remaining = new Array(10).fill(0);
    for (const ch of target) remaining[Number(ch)]++;
    let count = 0;
    for (const ch of guess) {
      const d = Number(ch);
      if (remaining[d] > 0) {
        count++;
        remaining[d]--;
      }
    }
    return { kind: "digitOverlap", count };
  },
  example(target) {
    const guess = "12348".slice(0, target.length).padEnd(target.length, "1");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    return `${result.count} of your ${guess.length} digits have a matching digit in the target.`;
  },
};
