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
  /** Per-slot digits known-certain from prior clues (length = digits).
   *  When provided AND the row is active (entering or pending before
   *  clue reveal), certain slots render in the match state and the
   *  player's typed `guess` fills only the non-certain slots. */
  certainDigits?: (string | null)[];
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

/**
 * Project-for-active-rows projection: given the player's typed input
 * (a string of length 0..capacity) and the per-slot certain overlay,
 * return a `digits`-long array where certain slots carry their known
 * digit and non-certain slots consume the typed input in order.
 * This is what the entering / pending rows render.
 */
function displayDigitsActive(
  typed: string,
  digits: number,
  certain: readonly (string | null)[] | undefined,
): (string | null)[] {
  const out: (string | null)[] = [];
  let idx = 0;
  for (let i = 0; i < digits; i++) {
    const c = certain?.[i] ?? null;
    if (c !== null) {
      out.push(c);
    } else {
      out.push(typed[idx++] ?? null);
    }
  }
  return out;
}

/** Per-slot state for active / pending rows. Certain slots paint match
 *  (they're target digits); non-certain typed slots paint entering;
 *  empty non-certain slots stay idle. */
function cellStatesActive(
  digits: number,
  certain: readonly (string | null)[] | undefined,
  displayed: readonly (string | null)[],
): DigitState[] {
  const out: DigitState[] = [];
  for (let i = 0; i < digits; i++) {
    const c = certain?.[i] ?? null;
    if (c !== null) out.push("match");
    else if (displayed[i] !== null) out.push("entering");
    else out.push("idle");
  }
  return out;
}

// --- player-side digit stats (used to render cmp-clue sub-labels) ---
//
// These mirror the helpers in the corresponding clue files but operate
// on the player's own guess so we can show the implied bound next to
// the direction symbol, e.g. "↑ 3" for "target has more than your 3".

function computeRange(s: string): number {
  const ds = [...s].map(Number);
  return Math.max(...ds) - Math.min(...ds);
}

function computeEvenCount(s: string): number {
  let n = 0;
  for (const ch of s) if (Number(ch) % 2 === 0) n++;
  return n;
}

const PRIME_SET = new Set([2, 3, 5, 7]);
function computePrimeCount(s: string): number {
  let n = 0;
  for (const ch of s) if (PRIME_SET.has(Number(ch))) n++;
  return n;
}

function computeMedian(s: string): number {
  const sorted = [...s].map(Number).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function computeDigitSum(s: string): number {
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  return sum;
}

/**
 * Builds the short in-row sub-label that sits under the clue name.
 * Comparison clues show a direction symbol plus the player's own value
 * so the implied bound reads cleanly ("↑ 3" = "target has more than 3").
 * Sum Delta keeps its exact magnitude.
 *
 * Exported so the unit test can assert text output without rendering.
 */
export function subLabelFor(
  guess: string,
  result: ClueResult,
): { text: string; className: string } | null {
  switch (result.kind) {
    case "rangeCompare":
    case "parityBalance":
    case "primeCount":
    case "median": {
      const own =
        result.kind === "rangeCompare"
          ? computeRange(guess)
          : result.kind === "parityBalance"
          ? computeEvenCount(guess)
          : result.kind === "primeCount"
          ? computePrimeCount(guess)
          : computeMedian(guess);
      const symbol =
        result.cmp === "eq" ? "=" : result.cmp === "gt" ? "↑" : "↓";
      const className =
        result.cmp === "eq"
          ? "text-good"
          : result.cmp === "gt"
          ? "text-warn"
          : "text-bad";
      return { text: `${symbol} ${own}`, className };
    }
    case "sumDelta": {
      // Sum Delta carries the exact signed distance; show the player's
      // own sum on ties and the delta (with explicit sign) otherwise.
      if (result.delta === 0) {
        const own = computeDigitSum(guess);
        return { text: `= ${own}`, className: "text-good" };
      }
      if (result.delta > 0) {
        return { text: `↑ +${result.delta}`, className: "text-warn" };
      }
      return {
        text: `↓ −${Math.abs(result.delta)}`,
        className: "text-bad",
      };
    }
    case "digitOverlap":
      return { text: `${result.count} shared`, className: "text-accent" };
    case "distinctDigits":
      return { text: `${result.count} unique`, className: "text-accent" };
    case "totalDeviation":
      return { text: `${result.value} off`, className: "text-accent" };
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
  guess,
  result,
}: {
  guess: string;
  result: ClueResult;
}) {
  const meta = getClueById(result.kind);
  const sub = subLabelFor(guess, result);
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
  certainDigits,
}: GuessRowProps) {
  // Three rendering modes:
  //   1. Resolved row (has `result`): paint from the clue result.
  //   2. Pending row (pending + active, no result yet): `guess` is the
  //      full submitted string; paint certain slots as match, the rest
  //      as entering.
  //   3. Entering row (active, no result, no pending): `guess` is just
  //      the player's typed string of length 0..capacity; interleave
  //      with certainDigits for display.
  const isActiveNoResult = active && !result;
  const displayed = result
    ? displayDigits(guess, digits, result)
    : isActiveNoResult && pending
    ? // Pending-row guess already contains certain digits (assembled on
      // submit), so just use it as-is.
      displayDigits(guess, digits, undefined)
    : displayDigitsActive(guess, digits, certainDigits);
  const states = result
    ? cellStates(result, digits)
    : cellStatesActive(digits, certainDigits, displayed);
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
    if (!interactive) return <ClueLabelContent guess={guess} result={result} />;
    return (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`Explain clue: ${meta?.name ?? ""}`}
        className="w-full text-right rounded-md hover:bg-surface-2/50 active:bg-surface-2 transition px-1"
      >
        <ClueLabelContent guess={guess} result={result} />
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
            // `states[i]` is authoritative — it already accounts for
            // certain slots (rendered as `match`) and the active-row
            // entering/idle logic. `animate` is only ON for resolved
            // rows so the typing row doesn't pulse on every keystroke.
            return (
              <Digit
                key={i}
                value={v}
                size="lg"
                state={states[i]}
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
