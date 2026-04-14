"use client";

import { Digit, type DigitState } from "./Digit";
import type { ClueResult } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";

interface GuessRowProps {
  guess: string;
  digits: number;
  result?: ClueResult;
  active?: boolean;
  pending?: boolean;
}

/** Per-slot color state derived from the clue result. */
function cellStates(
  result: ClueResult | undefined,
  digits: number,
): DigitState[] {
  if (!result) return new Array(digits).fill("idle");
  switch (result.kind) {
    case "bullseyes":
      return result.hits.map((h) => (h ? "match" : "idle"));
    case "higherLower":
      return result.cmp.map((c) =>
        c === "eq" ? "match" : c === "gt" ? "warm" : "cold",
      );
    case "within2":
      return result.mask.map((m) => (m ? "match" : "idle"));
    case "parityMask":
      return result.matches.map((m) => (m ? "match" : "idle"));
    case "oracle":
      return Array.from({ length: digits }, (_, i) =>
        i === result.slot ? "match" : "idle",
      );
    case "thermometer":
      return result.tier.map((t) => {
        if (t === 0) return "match"; // exact
        if (t === 1) return "close"; // within 1 (distinct from exact)
        if (t === 2) return "warm"; // within 3
        if (t === 3) return "cool"; // within 5
        return "cold"; // far
      });
    default:
      return new Array(digits).fill("idle");
  }
}

/** For Oracle, the revealed slot shows the target's digit instead of the guess. */
function displayDigits(
  guess: string,
  digits: number,
  result: ClueResult | undefined,
): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < digits; i++) out.push(guess[i] ?? null);
  if (result?.kind === "oracle") {
    out[result.slot] = String(result.digit);
  }
  return out;
}

/** Minimal LEFT-side label: clue name + a compact value chip for compositional clues. */
function ClueSideLabel({ result }: { result: ClueResult }) {
  const meta = getClueById(result.kind);
  let sub: React.ReactNode = null;
  let subClass = "text-muted";

  switch (result.kind) {
    case "sumDirection":
    case "rangeCompare":
    case "maxDigit":
    case "parityBalance":
    case "primeCount":
    case "median":
      sub =
        result.cmp === "eq" ? "equal" : result.cmp === "gt" ? "target ↑" : "target ↓";
      subClass =
        result.cmp === "eq"
          ? "text-good"
          : result.cmp === "gt"
          ? "text-warn"
          : "text-bad";
      break;
    case "sumDelta": {
      if (result.delta === 0) {
        sub = "equal";
        subClass = "text-good";
      } else if (result.delta > 0) {
        sub = `target +${result.delta}`;
        subClass = "text-warn";
      } else {
        sub = `target −${Math.abs(result.delta)}`;
        subClass = "text-bad";
      }
      break;
    }
    case "digitOverlap":
      sub = `${result.count} shared`;
      subClass = "text-accent";
      break;
    case "distinctDigits":
      sub = `${result.count} unique`;
      subClass = "text-accent";
      break;
    case "containsDigit":
      sub = `${result.digit}? ${result.present ? "yes" : "no"}`;
      subClass = result.present ? "text-good" : "text-bad";
      break;
    case "divisibleBy":
      if (result.present && result.divisor !== null) {
        sub = `${result.divisor}? yes`;
        subClass = "text-good";
      } else {
        sub = "divisible? no";
        subClass = "text-bad";
      }
      break;
    case "oracle":
      sub = `slot ${result.slot + 1}`;
      subClass = "text-muted";
      break;
    default:
      sub = null;
  }

  return (
    <div className="flex flex-col justify-center text-right min-w-0">
      <span className="text-[11px] font-semibold text-foreground truncate leading-tight">
        {meta.name}
      </span>
      {sub && (
        <span className={`text-[10px] font-mono ${subClass} truncate leading-tight`}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function GuessRow({
  guess,
  digits,
  result,
  active,
  pending,
}: GuessRowProps) {
  const states = cellStates(result, digits);
  const displayed = displayDigits(guess, digits, result);

  return (
    <div
      className={`w-full flex items-center gap-3 px-1 py-1.5 rounded-lg ${
        active ? "bg-surface/40" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        {pending && !result ? (
          <p className="text-[10px] text-muted text-right">pick a clue below…</p>
        ) : result ? (
          <ClueSideLabel result={result} />
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {displayed.map((v, i) => {
          const state: DigitState = result
            ? states[i]
            : active && v !== null
            ? "entering"
            : "idle";
          return (
            <Digit
              key={i}
              value={v}
              size="lg"
              state={state}
              animate={!!result}
            />
          );
        })}
      </div>
    </div>
  );
}
