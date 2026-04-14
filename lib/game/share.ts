import type { ClueId, ClueResult } from "./clues/types";
import type { ResolvedGuess } from "./stateMachine";

const CLUE_EMOJI: Record<ClueId, string> = {
  bullseyes: "🎯",
  higherLower: "↕️",
  within2: "◎",
  parityMask: "⚖️",
  oracle: "🔮",
  thermometer: "🌡️",
  sumDirection: "➕",
  sumDelta: "🔢",
  digitOverlap: "♻️",
  parityBalance: "⚪",
  primeCount: "🟣",
  rangeCompare: "🧭",
  containsDigit: "🔎",
  distinctDigits: "🎲",
  maxDigit: "🔝",
  median: "🎚️",
  divisibleBy: "➗",
  totalDeviation: "📐",
};

function perSlotLine(result: ClueResult | undefined, digits: number): string {
  if (!result) return "⬛".repeat(digits);
  switch (result.kind) {
    case "bullseyes":
      return result.hits.map((h) => (h ? "🟩" : "⬛")).join("");
    case "higherLower":
      return result.cmp
        .map((c) => (c === "eq" ? "🟩" : c === "gt" ? "🔼" : "🔽"))
        .join("");
    case "within2":
      return result.mask.map((m) => (m ? "🟨" : "⬛")).join("");
    case "parityMask":
      return result.matches.map((m) => (m ? "🟨" : "⬛")).join("");
    case "oracle": {
      const cells = Array.from({ length: digits }, (_, i) =>
        i === result.slot ? "🟩" : "⬛",
      );
      return cells.join("");
    }
    case "thermometer": {
      const map = ["🟩", "🟧", "🟨", "🟦", "⬛"];
      return result.tier.map((t) => map[t] ?? "⬛").join("");
    }
    default: {
      // Compositional clue — single emoji, padded.
      return `${CLUE_EMOJI[result.kind]} `.repeat(digits).trim();
    }
  }
}

export interface ShareOptions {
  title: string;
  won: boolean;
  guessCount: number;
  maxGuesses: number;
  digits: number;
  guesses: ResolvedGuess[];
}

export function buildShareText({
  title,
  won,
  guessCount,
  maxGuesses,
  digits,
  guesses,
}: ShareOptions): string {
  const header = `${title} ${won ? guessCount : "X"}/${maxGuesses}`;
  const lines = guesses.map((g) => {
    const emoji = g.clueId ? CLUE_EMOJI[g.clueId] : "⬜";
    return `${emoji} ${perSlotLine(g.result, digits)}`;
  });
  return [header, "", ...lines, "", "mathymath.app"].join("\n");
}
