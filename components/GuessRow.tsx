"use client";

import { useEffect, useRef, useState } from "react";
import { Digit, type DigitBadge, type DigitState } from "./Digit";
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
  /** Locks committed this turn (active row only). The slot cells render
   *  in locked-pending state with a 🔒 badge. */
  lockedSlots?: readonly { slot: number; digit: string }[];
  /** Slot currently in lock-entry mode (active row only). That cell
   *  gets the `selected` ring. */
  pendingLockSlot?: number | null;
  /** Lock records carried on this RESOLVED row so we can badge each
   *  locked cell with correct / wrong after submit. */
  locks?: readonly { slot: number; digit: string; correct: boolean }[];
  /** Fires when a cell on the active row is tapped. Only connected
   *  when the parent wants to expose the lock tap interaction. */
  onTapCell?: (slot: number) => void;
  /** Tightens cell width and inter-cell gap so the row fits on phone
   *  widths when `digits` is 6. Caller (GuessGrid) decides. */
  compact?: boolean;
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
      return result.mask.map((m, i) =>
        result.exact[i] ? "match" : m ? "warm" : "idle",
      );
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
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function computeDiceCount(s: string): number {
  let n = 0;
  for (const ch of s) {
    const d = Number(ch);
    if (d >= 1 && d <= 6) n++;
  }
  return n;
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
    case "median":
    case "diceCount": {
      const own =
        result.kind === "rangeCompare"
          ? computeRange(guess)
          : result.kind === "parityBalance"
          ? computeEvenCount(guess)
          : result.kind === "primeCount"
          ? computePrimeCount(guess)
          : result.kind === "diceCount"
          ? computeDiceCount(guess)
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
    case "extraLock":
      // Special card — not a target clue. Surface the reward instead.
      return { text: "+1 🔒", className: "text-good" };
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
  // `h-full` + `justify-center` makes the two-line block genuinely
  // vertically centered against the digit cells in the same row.
  // `text-left` balances the row: the label now hugs the main's left
  // padding instead of right-aligning and leaving a big variable gap
  // on the left that didn't match the right-edge padding.
  return (
    <div className="flex flex-col justify-center text-left min-w-0 h-full">
      <span className="text-[12px] sm:text-[13px] font-semibold text-foreground truncate leading-tight">
        {meta.name}
      </span>
      {sub && (
        <span className={`text-[11px] sm:text-[12px] font-mono ${sub.className} truncate leading-tight`}>
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
  lockedSlots,
  pendingLockSlot,
  locks,
  onTapCell,
  compact = false,
}: GuessRowProps) {
  // ---------------------------------------------------------------
  // Project a per-cell view for each render mode:
  //   1. Resolved row: paint from clue result, overlay lock correctness
  //      badges and flip lock-correct cells to match state.
  //   2. Pending row (submitted but awaiting clue): full guess is in
  //      `guess`; certain slots match, locked slots show locked-pending.
  //   3. Entering row: interleave certain + locks + typed input.
  // ---------------------------------------------------------------
  const displayed: (string | null)[] = new Array(digits).fill(null);
  const states: DigitState[] = new Array(digits).fill("idle");
  const badges: (DigitBadge | undefined)[] = new Array(digits).fill(undefined);
  const selected: boolean[] = new Array(digits).fill(false);

  if (result) {
    const d = displayDigits(guess, digits, result);
    const s = cellStates(result, digits);
    for (let i = 0; i < digits; i++) {
      displayed[i] = d[i];
      states[i] = s[i];
    }
    // Post-submit lock badges + override for correct locks (they're
    // always visually match regardless of what the chosen clue says
    // about that slot).
    for (const l of locks ?? []) {
      if (l.slot < 0 || l.slot >= digits) continue;
      badges[l.slot] = l.correct ? "lock-correct" : "lock-wrong";
      if (l.correct) states[l.slot] = "match";
    }
  } else if (pending) {
    // Pending row: guess is already the full submitted string (the
    // reducer assembled certain + locks + typed on submit).
    const d = displayDigits(guess, digits, undefined);
    for (let i = 0; i < digits; i++) {
      displayed[i] = d[i];
      const c = certainDigits?.[i] ?? null;
      if (c !== null) states[i] = "match";
      else if (d[i] !== null) states[i] = "entering";
    }
    // Locked slots on the pending row: flip state + badge so they read
    // as "locked, correctness TBD".
    for (const l of lockedSlots ?? []) {
      states[l.slot] = "locked-pending";
      badges[l.slot] = "lock-pending";
    }
  } else if (active) {
    // Entering row: interleave certain + committed locks + typed input.
    const overlay: (string | null)[] = new Array(digits).fill(null);
    for (let i = 0; i < digits; i++) {
      overlay[i] = certainDigits?.[i] ?? null;
    }
    for (const l of lockedSlots ?? []) overlay[l.slot] = l.digit;
    const d = displayDigitsActive(guess, digits, overlay);
    for (let i = 0; i < digits; i++) {
      displayed[i] = d[i];
      const c = certainDigits?.[i] ?? null;
      const lk = lockedSlots?.find((l) => l.slot === i);
      if (c !== null) states[i] = "match";
      else if (lk) {
        states[i] = "locked-pending";
        badges[i] = "lock-pending";
      } else if (d[i] !== null) states[i] = "entering";
    }
    // Lock-entry mode: ring the selected cell. If it doesn't yet have
    // a digit, paint it as locked-pending (empty) so the UI hints that
    // the next number press will fill it.
    if (pendingLockSlot != null && pendingLockSlot >= 0 && pendingLockSlot < digits) {
      selected[pendingLockSlot] = true;
      const hasDigit = lockedSlots?.some((l) => l.slot === pendingLockSlot);
      if (!hasDigit) {
        states[pendingLockSlot] = "locked-pending";
        badges[pendingLockSlot] = "lock-pending";
      }
    }
  } else {
    // No result + not active — defensive fallback (shouldn't render).
    const d = displayDigits(guess, digits, undefined);
    for (let i = 0; i < digits; i++) displayed[i] = d[i];
  }
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
      return (
        <div className="flex h-full items-center justify-start">
          <p className="text-[11px] sm:text-[12px] text-muted text-left">
            pick a clue below…
          </p>
        </div>
      );
    if (!result) return null;
    if (!interactive) return <ClueLabelContent guess={guess} result={result} />;
    return (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`Explain clue: ${meta?.name ?? ""}`}
        className="w-full h-full text-left rounded-md hover:bg-surface-2/50 active:bg-surface-2 transition px-1"
      >
        <ClueLabelContent guess={guess} result={result} />
      </button>
    );
  })();

  return (
    <div ref={containerRef} className="w-full">
      <div
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg ${
          active ? "bg-surface/40" : ""
        }`}
      >
        {/* `min-w-[6rem]` keeps every row's label column the same size so
             digits line up across rows; `shrink-0` (instead of `flex-1`)
             means the row no longer stretches label whitespace out to the
             right — the content hugs the left with slack on the right.
             `h-10 sm:h-11` matches the digit cell height so the `h-full`
             chain inside ClueLabelContent can genuinely vertically
             center the name + sub-label block against those cells. */}
        <div
          className={`shrink-0 h-10 sm:h-11 ${
            compact ? "min-w-[4.5rem] sm:min-w-[5rem]" : "min-w-[6rem]"
          }`}
        >
          {labelSlot}
        </div>
        <div
          className={`flex items-center shrink-0 ${
            compact ? "gap-1 sm:gap-1.5" : "gap-1.5 sm:gap-2"
          }`}
        >
          {displayed.map((v, i) => {
            // Active (entering) rows make their non-certain cells
            // tappable when the parent provides `onTapCell`. Certain
            // cells are never tappable — they're immutable.
            const isCertain = (certainDigits?.[i] ?? null) !== null;
            const tappable =
              active && !result && !pending && onTapCell && !isCertain;
            return (
              <Digit
                key={i}
                value={v}
                size={compact ? "lg-narrow" : "lg"}
                state={states[i]}
                animate={!!result}
                badge={badges[i]}
                selected={selected[i]}
                onClick={tappable ? () => onTapCell!(i) : undefined}
                ariaLabel={tappable ? `Select slot ${i + 1} to lock` : undefined}
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
