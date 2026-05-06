import type { Clue } from "./types";

export const parityMaskClue: Clue<{ kind: "parityMask"; count: number }> = {
  id: "parityMask",
  name: "Odd or Even",
  category: "positional",
  description:
    "Reports how many slots' parity (odd/even) matches the target's parity. The matching slots are not identified — only the count.",
  weight: 0.8,
  compute(guess, target) {
    let count = 0;
    for (let i = 0; i < guess.length; i++) {
      if (Number(guess[i]) % 2 === Number(target[i]) % 2) count++;
    }
    return { kind: "parityMask", count };
  },
  example(target) {
    const guess = "13246".slice(0, target.length).padEnd(target.length, "0");
    return { guess, result: this.compute(guess, target) };
  },
  explain(guess, result) {
    if (result.count === 0)
      return "No slots share parity with the target.";
    if (result.count === guess.length)
      return "Every slot matches the target's parity.";
    return `${result.count} of ${guess.length} slots match the target's parity.`;
  },
};
