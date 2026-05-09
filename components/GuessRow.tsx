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
  /** When true, this resolved row terminated the game in a win even
   *  though the typed `guess` is not the target — i.e. an Oracle (or
   *  Clue-Reuse-of-Oracle) reveal completed the certain set. The row
   *  is repainted to show the full target with every slot in match
   *  state, mirroring how a literal correct guess renders. Requires
   *  `certainDigits` to carry the full target. */
  winRow?: boolean;
  /** Preselected-clues mode: the clue assigned to this row (visible
   *  before the player guesses). Renders the clue's name in the label
   *  slot. The tap-to-explain popover is suppressed until the row
   *  resolves so the player can't peek at the clue's behavior in
   *  advance. */
  upcomingClue?: Clue | null;
  /** Marks this row as the next one to be filled in preselected mode.
   *  Adds a subtle highlight so the player can find their place. */
  nextUp?: boolean;
}

/** Per-slot color state derived from the clue result. The `guess`
 *  is needed for clues like Contains Digit whose per-pick result
 *  must map back to slot positions in the player's input. */
function cellStates(
  result: ClueResult | undefined,
  digits: number,
  guess: string,
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
      // Mask-only: exact slots no longer paint green. The clue intent
      // is "within 2", and singling out exact matches visually would
      // hand the player a free Bullseye — same rationale as
      // deriveCertainDigits no longer promoting Within-2 exacts.
      return result.mask.map((m) => (m ? "warm" : "idle"));
    case "parityMask":
      // Warm highlight on each slot whose parity matches the
      // target's parity at that slot.
      return result.matches.map((m) => (m ? "warm" : "idle"));
    case "distinctDigits":
      // Sub-label still shows the count of distinct digits in target.
      // Per-slot warm highlights guess digits that are repeated in
      // BOTH guess and target — a small guess-dependent kicker on
      // top of the guess-independent count.
      return result.sharedRepeated.map((m) => (m ? "warm" : "idle"));
    case "digitOverlap":
      // Wordle-yellow: warm for digits that appear in the target
      // (multiset-aware — repeated guess digits beyond the target's
      // count stay idle). No slot-positional certainty implied.
      return result.mask.map((m) => (m ? "warm" : "idle"));
    case "elimination":
      // Inverse of Echo: cold for digits that are ABSENT from the
      // target entirely.
      return result.mask.map((m) => (m ? "cold" : "idle"));
    case "oracle":
      return Array.from({ length: digits }, (_, i) =>
        i === result.slot ? "match" : "idle",
      );
    case "thermometer":
      // 3 visual tiers without `match` (green): green is reserved for
      // clues that turn a slot into certainty, and thermometer no
      // longer does. close → warm → cold reads as a clean cooling
      // ramp matching the 3 numerical tiers.
      return result.tier.map((t) => {
        if (t === 0) return "close";
        if (t === 1) return "warm";
        return "cold";
      });
    case "containsDigit": {
      // Walk the picks left-to-right and color the leftmost
      // not-yet-claimed slot in the guess that holds each picked
      // digit. Correct picks → warm (yellow); the wrong pick (if
      // any, always last by construction) → cold (red).
      const states: DigitState[] = new Array(digits).fill("idle");
      const queues = new Map<string, number[]>();
      for (let i = 0; i < guess.length; i++) {
        const ch = guess[i];
        if (queues.has(ch)) queues.get(ch)!.push(i);
        else queues.set(ch, [i]);
      }
      for (const pick of result.picks) {
        const queue = queues.get(String(pick.digit));
        if (!queue || queue.length === 0) continue;
        const slot = queue.shift()!;
        states[slot] = pick.present ? "warm" : "cold";
      }
      return states;
    }
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

function computeDirectionRuns(s: string): number {
  let count = 0;
  let lastDir: "up" | "down" | null = null;
  for (let i = 0; i < s.length - 1; i++) {
    const a = Number(s[i]);
    const b = Number(s[i + 1]);
    if (a === b) continue;
    const dir: "up" | "down" = b > a ? "up" : "down";
    if (dir !== lastDir) {
      count++;
      lastDir = dir;
    }
  }
  return count;
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
/** Sub-label model. `text` + `className` is the simple single-color
 *  case. When `parts` is present the renderer joins each part with a
 *  space and gives each its own color — used by Contains Digit so
 *  ✓ marks turn green and ✗ marks turn red within the same row. */
export interface SubLabel {
  text: string;
  className: string;
  parts?: { text: string; className: string }[];
}

export function subLabelFor(
  guess: string,
  result: ClueResult,
): SubLabel | null {
  switch (result.kind) {
    case "rangeCompare":
    case "parityBalance":
    case "primeCount":
    case "median":
    case "diceCount":
    case "upsAndDowns": {
      const own =
        result.kind === "rangeCompare"
          ? computeRange(guess)
          : result.kind === "parityBalance"
          ? computeEvenCount(guess)
          : result.kind === "primeCount"
          ? computePrimeCount(guess)
          : result.kind === "diceCount"
          ? computeDiceCount(guess)
          : result.kind === "upsAndDowns"
          ? computeDirectionRuns(guess)
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
      // Show the target's digit sum prominently, with the signed delta
      // from the player's guess in parentheses. e.g. "15 (−10)" means
      // the target's digit sum is 15 and the player's guess summed to
      // 25. On a perfect tie we drop the parenthetical.
      const own = computeDigitSum(guess);
      const target = own + result.delta;
      if (result.delta === 0) {
        return { text: `${target}`, className: "text-good" };
      }
      const sign = result.delta > 0 ? "+" : "−";
      return {
        text: `${target} (${sign}${Math.abs(result.delta)})`,
        className: result.delta > 0 ? "text-warn" : "text-bad",
      };
    }
    case "parityMask": {
      const n = result.matches.filter(Boolean).length;
      return {
        text: n === 1 ? "1 match" : `${n} matches`,
        className: "text-accent",
      };
    }
    case "bullseyeTrend": {
      // Direction-of-progress clue: ↑ (more matches) is GOOD,
      // ↓ is BAD. Departs from the cmp-clue convention where
      // eq=good, gt=warn, lt=bad — that mapping fits "your value vs
      // target's value" but not "your latest vs your previous."
      // Show the exact delta so the player can see *how much* their
      // matches moved, not just direction.
      if (result.delta > 0)
        return {
          text: `${result.delta} more`,
          className: "text-good",
        };
      if (result.delta < 0)
        return {
          text: `${Math.abs(result.delta)} less`,
          className: "text-bad",
        };
      return { text: "= same", className: "text-muted" };
    }
    case "distinctDigits":
      return { text: `${result.count} unique`, className: "text-accent" };
    case "totalDeviation":
      return { text: `${result.value} off`, className: "text-accent" };
    case "containsDigit": {
      // Show every pick the player made, with ✓ for in-target (yellow)
      // and ✗ for the wrong one (red — always the last, by
      // construction). Per-pick colors via the `parts` channel so the
      // checks and the cross don't share a single dominant color.
      // Yellow on hits matches Digit Overlap's "shared info" hue.
      if (result.picks.length === 0)
        return { text: "no picks", className: "text-muted" };
      const parts = result.picks.map((p) => ({
        text: `${p.digit}${p.present ? "✓" : "✗"}`,
        className: p.present ? "text-warn" : "text-bad",
      }));
      const text = parts.map((p) => p.text).join(" ");
      const lastWrong =
        result.picks[result.picks.length - 1].present === false;
      return {
        text,
        className: lastWrong ? "text-bad" : "text-warn",
        parts,
      };
    }
    case "divisibleBy":
      // Hits use text-warn so the helper-text color matches Digit
      // Overlap's hits — both convey "shared info" between guess
      // and target, and aligning them keeps the chooser palette
      // predictable. The "no shared" / "no 2-9 divisor" cases stay
      // text-bad.
      if (result.divisors.length > 0)
        return {
          text: `÷ ${result.divisors.join(" ")}`,
          className: "text-warn",
        };
      if (result.targetHasAny)
        return { text: "no shared divisor", className: "text-bad" };
      return { text: "no 2-9 divisor", className: "text-bad" };
    case "digitOverlap": {
      // Multiset-aware Wordle-yellow: a slot is warm only while the
      // target's count for that digit is still positive. Sub-label
      // lists the distinct hit digits in guess order with a ✓ after
      // each, mirroring Contains Digit's pick-history format.
      const seen = new Set<string>();
      const distinct: string[] = [];
      result.mask.forEach((m, i) => {
        if (!m) return;
        const d = guess[i];
        if (!seen.has(d)) {
          seen.add(d);
          distinct.push(d);
        }
      });
      if (distinct.length === 0)
        return { text: "no hits", className: "text-muted" };
      return {
        text: distinct.map((d) => `${d}✓`).join(" "),
        className: "text-warn",
      };
    }
    case "elimination": {
      // Mirrored from Digit Overlap: a guess digit's slot is cold
      // only when that digit is COMPLETELY absent from the target.
      // Sub-label lists each distinct excluded digit with an ✗ so it's
      // clear what's been ruled out (and not extrapolated to copies).
      const seen = new Set<string>();
      const distinct: string[] = [];
      result.mask.forEach((m, i) => {
        if (!m) return;
        const d = guess[i];
        if (!seen.has(d)) {
          seen.add(d);
          distinct.push(d);
        }
      });
      if (distinct.length === 0)
        return { text: "no misses", className: "text-muted" };
      return {
        text: distinct.map((d) => `${d}✗`).join(" "),
        className: "text-bad",
      };
    }
    case "oracle": {
      // The player's own digit at the revealed slot tells us how far
      // off they were. Cell coloring already shows WHICH slot was
      // revealed; the sub-label conveys HOW WRONG the guess was at
      // that slot — also a hint that Oracle's auto-pick chose this
      // slot because it had the largest delta.
      const off = Math.abs(
        Number(guess[result.slot]) - result.digit,
      );
      return { text: `${off} off`, className: "text-accent" };
    }
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
        <span
          className={`text-[11px] sm:text-[12px] font-mono truncate leading-tight ${sub.parts ? "" : sub.className}`}
        >
          {sub.parts
            ? sub.parts.map((p, i) => (
                <span key={i} className={p.className}>
                  {i > 0 ? " " : ""}
                  {p.text}
                </span>
              ))
            : sub.text}
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
  winRow = false,
  upcomingClue,
  nextUp,
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
    if (winRow && certainDigits) {
      // Oracle-induced win: paint the full target and mark every slot
      // as match, so the row reads the same as a literal correct
      // guess. `certainDigits` is authoritative here — by the time the
      // game ends this way, every slot is known.
      for (let i = 0; i < digits; i++) {
        displayed[i] = certainDigits[i] ?? guess[i] ?? null;
        states[i] = "match";
      }
    } else {
      const d = displayDigits(guess, digits, result);
      const s = cellStates(result, digits, guess);
      for (let i = 0; i < digits; i++) {
        displayed[i] = d[i];
        states[i] = s[i];
      }
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
    // Preselected-clues mode: when an upcomingClue is pinned to this
    // row but it hasn't resolved yet, show the clue NAME as a button
    // that opens a popover with the clue's description (the same text
    // the in-game chooser shows). Once resolved, the row falls
    // through to the standard interactive explainer below.
    if (!result && upcomingClue) {
      return (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`Show description: ${upcomingClue.name}`}
          className="w-full h-full flex flex-col justify-center text-left min-w-0 rounded-md hover:bg-surface-2/50 active:bg-surface-2 transition px-1"
        >
          <span
            className={`text-[12px] sm:text-[13px] truncate leading-tight ${
              nextUp
                ? "font-bold text-accent"
                : "font-semibold text-muted"
            }`}
          >
            {upcomingClue.name}
          </span>
        </button>
      );
    }
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
      {expanded && !result && upcomingClue && (
        <div
          role="tooltip"
          className="mx-1 mt-1 mb-1 bg-surface-2 rounded-md border border-border px-3 py-2 text-[11px] leading-snug text-muted"
        >
          <p className="text-[9px] uppercase tracking-wider text-muted mb-1">
            {upcomingClue.name}
          </p>
          <p>{upcomingClue.description}</p>
        </div>
      )}
    </div>
  );
}
