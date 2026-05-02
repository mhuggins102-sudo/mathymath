import type { ClueId, ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import type { DeductionPuzzle } from "./puzzles";
import capturedJson from "@/scripts/captured-puzzles.json";

interface CapturedJsonGuess {
  guess: string;
  clueId: ClueId;
  result: ClueResult;
}

interface CapturedJsonPuzzle {
  id: string;
  digits: number;
  target: string;
  guesses: CapturedJsonGuess[];
  unknownSlots: number;
  candidatesBeforeFinal: number;
}

/** Auto-generate the post-wrong explanation by chaining each clue's
 *  built-in `explain` text. Less polished than the hand-written ones
 *  on the original 5 puzzles, but accurate. */
function buildExplanation(p: CapturedJsonPuzzle): string {
  const parts: string[] = [];
  for (const g of p.guesses) {
    const clue = getClueById(g.clueId);
    parts.push(`${clue.name} on ${g.guess}: ${clue.explain(g.guess, g.result)}`);
  }
  parts.push(
    `Combining all of the above, the only number consistent with every clue is ${p.target}.`,
  );
  return parts.join(" ");
}

const RAW = capturedJson as { puzzles: CapturedJsonPuzzle[] };

export const CAPTURED_DEDUCTION_PUZZLES: DeductionPuzzle[] = RAW.puzzles.map(
  (p) => ({
    id: p.id,
    digits: p.digits,
    target: p.target,
    guesses: p.guesses.map((g) => ({
      guess: g.guess,
      clueId: g.clueId,
      result: g.result,
    })),
    explanation: buildExplanation(p),
  }),
);
