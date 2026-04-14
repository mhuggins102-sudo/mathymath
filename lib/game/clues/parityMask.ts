import type { Clue } from "./types";

export const parityMaskClue: Clue<{ kind: "parityMask"; matches: boolean[] }> = {
  id: "parityMask",
  name: "Parity Mask",
  category: "positional",
  description:
    "For each slot, shows whether your digit's parity (even/odd) matches the target's parity at that slot.",
  weight: 1.0,
  compute(guess, target) {
    const matches = [...guess].map(
      (ch, i) => Number(ch) % 2 === Number(target[i]) % 2,
    );
    return { kind: "parityMask", matches };
  },
  example(target) {
    const guess = "2".repeat(target.length);
    return { guess, result: this.compute(guess, target) };
  },
};
