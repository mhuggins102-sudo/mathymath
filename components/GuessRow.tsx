"use client";

import { useState } from "react";
import { Digit, type DigitState } from "./Digit";
import type { Clue, ClueResult, ClueResultFor } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";

interface GuessRowProps {
  guess: string;
  digits: number;
  result?: ClueResult;
  active?: boolean;
  pending?: boolean;
  /**
   * When true, the clue label is a button that toggles an in-row
   * explanation panel (tap to see plain-language detail). Off by default
   * so the Help modal renders plain rows.
   */
  interactive?: boolean;
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
        if (t === 0) return "match";
        if (t === 1) return "close";
        if (t === 2) return "warm";
        if (t === 3) return "cool";
        return "cold";
      });
    default:
      return new Array(digits).fill("idle");
  }
}

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

/** Compact chip text + color for the sub-label next to the clue name. */
function subLabelFor(result: ClueResult): { text: string; className: string } | null {
  switch (result.kind) {
    case "sumDirection":
    case "rangeCompare":
    case "maxDigit":
    case "parityBalance":
    case "primeCount":
    case "median":
      return {
        text:
          result.cmp === "eq" ? "equal" : result.cmp === "gt" ? "target ↑" : "target ↓",
        className:
          result.cmp === "eq"
            ? "text-good"
            : result.cmp === "gt"
            ? "text-warn"
            : "text-bad",
      };
    case "sumDelta": {
      if (result.delta === 0) return { text: "equal", className: "text-good" };
      if (result.delta > 0)
        return { text: `target +${result.delta}`, className: "text-warn" };
      return { text: `target −${Math.abs(result.delta)}`, className: "text-bad" };
    }
    case "digitOverlap":
      return { text: `${result.count} shared`, className: "text-accent" };
    case "distinctDigits":
      return { text: `${result.count} unique`, className: "text-accent" };
    case "containsDigit":
      return {
        text: `${result.digit}? ${result.present ? "yes" : "no"}`,
        className: result.present ? "text-good" : "text-bad",
      };
    case "divisibleBy":
      if (result.present && result.divisor !== null)
        return { text: `${result.divisor}? yes`, className: "text-good" };
      return { text: "divisible? no", className: "text-bad" };
    case "oracle":
      return { text: `slot ${result.slot + 1}`, className: "text-muted" };
    default:
      return null;
  }
}

function ClueSideLabel({
  result,
  guess,
  interactive,
}: {
  result: ClueResult;
  guess: string;
  interactive: boolean;
}) {
  const meta = getClueById(result.kind) as Clue;
  const sub = subLabelFor(result);
  const [open, setOpen] = useState(false);
  const explanation = interactive
    ? (meta.explain as (g: string, r: ClueResult) => string)(
        guess,
        result as ClueResultFor<typeof result.kind>,
      )
    : null;

  const labelBody = (
    <div className="flex flex-col justify-center text-right min-w-0">
      <span className="text-[11px] font-semibold text-foreground truncate leading-tight">
        {meta.name}
      </span>
      {sub && (
        <span className={`text-[10px] font-mono ${sub.className} truncate leading-tight`}>
          {sub.text}
        </span>
      )}
    </div>
  );

  if (!interactive) return labelBody;

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Explain clue: ${meta.name}`}
        className="w-full text-right rounded-md hover:bg-surface-2/50 active:bg-surface-2 transition px-1"
      >
        {labelBody}
      </button>
      {open && explanation && (
        <div
          className="absolute right-0 top-full mt-1 z-30 w-60 rounded-md border border-border bg-surface-2 shadow-lg px-3 py-2 text-[11px] leading-snug text-foreground"
          onClick={() => setOpen(false)}
          role="tooltip"
        >
          <p className="mb-1 text-[9px] uppercase tracking-wider text-muted">
            {meta.name}
          </p>
          <p>{explanation}</p>
        </div>
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
  interactive = false,
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
          <ClueSideLabel result={result} guess={guess} interactive={interactive} />
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
