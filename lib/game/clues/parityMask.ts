import type { Clue } from "./types";

export const parityMaskClue: Clue<{
  kind: "parityMask";
  matches: boolean[];
}> = {
  id: "parityMask",
  name: "Odd or Even",
  category: "positional",
  description:
    "Highlights each slot whose parity (odd/even) matches the target's parity at that slot.",
  weight: 0.8,
  legend: [{ state: "warm", label: "parity matches" }],
  compute(guess, target) {
    const matches = [...guess].map(
      (ch, i) => Number(ch) % 2 === Number(target[i]) % 2,
    );
    return { kind: "parityMask", matches };
  },
  example(target) {
    const guess = "13246".slice(0, target.length).padEnd(target.length, "0");
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    const slots = result.matches
      .map((m, i) => (m ? String(i + 1) : null))
      .filter((v): v is string => v !== null);
    if (slots.length === 0)
      return "No slots share parity with the target.";
    if (slots.length === result.matches.length)
      return "Every slot matches the target's parity.";
    return `Slots ${slots.join(", ")} share parity with the target.`;
  },
};
