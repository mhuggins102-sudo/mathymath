import type { Clue, Cmp } from "./types";

function cmp(target: number, guess: number): Cmp {
  if (target === guess) return "eq";
  return target > guess ? "gt" : "lt";
}

export const higherLowerClue: Clue<{ kind: "higherLower"; cmp: Cmp[] }> = {
  id: "higherLower",
  name: "Higher or Lower",
  category: "positional",
  description:
    "For each slot: does your digit match, or is the target's higher or lower?",
  // Highest-info clue in the roster (~8 bits per pick). Weight held low so
  // it doesn't dominate the chooser pool.
  weight: 0.4,
  legend: [
    { state: "match", label: "match" },
    { state: "warm", label: "target higher" },
    { state: "cold", label: "target lower" },
  ],
  compute(guess, target) {
    const out: Cmp[] = [];
    for (let i = 0; i < guess.length; i++) {
      out.push(cmp(Number(target[i]), Number(guess[i])));
    }
    return { kind: "higherLower", cmp: out };
  },
  example(target) {
    const first = target[0] ?? "5";
    const guess = (first + "5555").slice(0, target.length);
    return { guess, result: this.compute(guess, target) };
  },
  explain(_guess, result) {
    const eq = result.cmp.filter((c) => c === "eq").length;
    const gt = result.cmp.filter((c) => c === "gt").length;
    const lt = result.cmp.filter((c) => c === "lt").length;
    const parts: string[] = [];
    if (eq > 0) parts.push(`${eq} match`);
    if (gt > 0) parts.push(`${gt} higher`);
    if (lt > 0) parts.push(`${lt} lower`);
    return parts.join(" · ");
  },
};
