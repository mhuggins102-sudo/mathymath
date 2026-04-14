"use client";

import { useEffect, useRef, useState } from "react";
import { Digit, type DigitState } from "./Digit";
import type { Clue, ClueResult, ClueResultFor } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";

interface GuessRowProps {
  guess: string;
  digits: number;
  result?: ClueResult;
  active?: boolean;
  pending?: boolean;
  /** When true, the clue label is a button that expands a plain-language
   *  explanation panel below the row. Off by default so Help-modal rows
   *  render plain and non-interactive. */
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
    case "totalDeviation":
      return {
        text: `${result.value} off`,
        className: result.value === 0 ? "text-good" : "text-warn",
      };
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

function ClueLabelContent({
  result,
}: {
  result: ClueResult;
}) {
  const meta = getClueById(result.kind);
  const sub = subLabelFor(result);
  return (
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
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on any click outside this row's interactive area. Runs only while
  // expanded so we don't hold an idle listener.
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current && containerRef.current.contains(target)) return;
      setExpanded(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [expanded]);

  const meta = result ? (getClueById(result.kind) as Clue) : null;
  const explanation =
    interactive && result && meta
      ? (meta.explain as (g: string, r: ClueResult) => string)(
          guess,
          result as ClueResultFor<typeof result.kind>,
        )
      : null;

  const labelSlot = (() => {
    if (pending && !result)
      return <p className="text-[10px] text-muted text-right">pick a clue below…</p>;
    if (!result) return null;
    if (!interactive) return <ClueLabelContent result={result} />;
    return (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`Explain clue: ${meta?.name ?? ""}`}
        className="w-full text-right rounded-md hover:bg-surface-2/50 active:bg-surface-2 transition px-1"
      >
        <ClueLabelContent result={result} />
      </button>
    );
  })();

  return (
    <div ref={containerRef} className="w-full">
      <div
        className={`w-full flex items-center gap-3 px-1 py-1.5 rounded-lg ${
          active ? "bg-surface/40" : ""
        }`}
      >
        {/* `min-w-[6rem]` keeps every row's label column the same size so
             digits line up across rows; `shrink-0` (instead of `flex-1`)
             means the row no longer stretches label whitespace out to the
             right — the content hugs the left with slack on the right. */}
        <div className="min-w-[6rem] shrink-0">{labelSlot}</div>
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
      {expanded && explanation && meta && (
        <div
          role="tooltip"
          className="mx-1 mt-1 mb-1 bg-surface-2 rounded-md border border-border px-3 py-2 text-[11px] leading-snug text-foreground"
        >
          <p className="text-[9px] uppercase tracking-wider text-muted mb-1">
            {meta.name}
          </p>
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
}
