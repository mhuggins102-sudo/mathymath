import type { Clue } from "./types";
import { seededRng } from "../seededRng";

export const oracleClue: Clue<{ kind: "oracle"; slot: number; digit: number }> = {
  id: "oracle",
  name: "Oracle",
  category: "positional",
  description:
    "Reveals the exact target digit at one slot. The slot is picked pseudo-randomly from your guess and the target, so it's a bit of a gamble — but the same guess on the same puzzle will always reveal the same slot.",
  weight: 0.7,
  legend: [{ state: "match", label: "revealed digit" }],
  compute(guess, target) {
    const rng = seededRng(`oracle:${guess}:${target}`);
    const slot = Math.floor(rng() * target.length);
    return { kind: "oracle", slot, digit: Number(target[slot]) };
  },
  example(target) {
    const guess = "12345".slice(0, target.length).padEnd(target.length, "0");
    return { guess, result: this.compute(guess, target) };
  },
};
