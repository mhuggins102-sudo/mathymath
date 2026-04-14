import type { Clue } from "./types";

export const parityMaskClue: Clue<{ kind: "parityMask"; matches: boolean[] }> = {
  id: "parityMask",
  name: "Parity Mask",
  category: "positional",
  description:
    "For each slot, shows whether your digit's parity (even/odd) matches the target's parity at that slot.",
  weight: 1.0,
  legend: [{ state: "match", label: "parity matches" }],
  compute(guess, target) {
    const matches = [...guess].map(
      (ch, i) => Number(ch) % 2 === Number(target[i]) % 2,
    );
    return { kind: "parityMask", matches };
  },
  example(target) {
    // Alternating parity "13246" shows a mix of parity matches/misses on
    // most targets.
    const guess = "13246".slice(0, target.length).padEnd(target.length, "0");
    return { guess, result: this.compute(guess, target) };
  },
};
