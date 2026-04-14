"use client";

import { Digit } from "./Digit";
import { ClueBadge } from "./ClueBadge";
import type { ClueResult } from "@/lib/game/clues/types";

interface GuessRowProps {
  guess: string;
  digits: number;
  result?: ClueResult;
  active?: boolean;
  pending?: boolean;
}

export function GuessRow({
  guess,
  digits,
  result,
  active,
  pending,
}: GuessRowProps) {
  const slots: (string | null)[] = [];
  for (let i = 0; i < digits; i++) {
    slots.push(guess[i] ?? null);
  }

  // Per-slot state for coloring.
  const slotState = (i: number): "idle" | "exact" | "hint" | "miss" => {
    if (!result) return "idle";
    switch (result.kind) {
      case "bullseyes":
        return result.hits[i] ? "exact" : "idle";
      case "higherLower":
        return result.cmp[i] === "eq" ? "exact" : "idle";
      case "within2":
        return result.mask[i] ? "hint" : "idle";
      case "parityMask":
        return result.matches[i] ? "hint" : "idle";
      case "oracle":
        return i === result.slot ? "exact" : "idle";
      case "thermometer":
        return result.tier[i] === 0
          ? "exact"
          : result.tier[i] <= 1
          ? "hint"
          : "idle";
      default:
        return "idle";
    }
  };

  return (
    <div
      className={`w-full flex flex-col gap-2 px-1 py-2 rounded-lg ${
        active ? "bg-surface/40" : ""
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {slots.map((v, i) => (
          <Digit
            key={i}
            value={v}
            size="lg"
            filled={v !== null}
            state={slotState(i)}
            animate={!!result}
          />
        ))}
      </div>
      {pending && !result ? (
        <p className="text-center text-xs text-muted">Pick a clue above to reveal.</p>
      ) : result ? (
        <div className="flex justify-center">
          <ClueBadge result={result} guess={guess} />
        </div>
      ) : null}
    </div>
  );
}
