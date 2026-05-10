import { getClueById } from "@/lib/game/clues/registry";
import type { ClueResult } from "@/lib/game/clues/types";
import { medianValue } from "@/lib/game/clues/statSummary";
import { directionRuns } from "@/lib/game/clues/upsAndDowns";
import type { DeductionPuzzle } from "./puzzles";

/** Helpers — all pure functions of a digit string, mirroring the
 *  per-clue compute() logic in lib/game/clues/* but kept local so this
 *  module doesn't pull in compute paths it doesn't need. */
function digitSum(s: string): number {
  let n = 0;
  for (const ch of s) n += +ch;
  return n;
}
function evenCount(s: string): number {
  let n = 0;
  for (const ch of s) if (+ch % 2 === 0) n++;
  return n;
}
const PRIMES = new Set([2, 3, 5, 7]);
function primeDigitCount(s: string): number {
  let n = 0;
  for (const ch of s) if (PRIMES.has(+ch)) n++;
  return n;
}
function diceDigitCount(s: string): number {
  let n = 0;
  for (const ch of s) {
    const d = +ch;
    if (d >= 1 && d <= 6) n++;
  }
  return n;
}
function digitRange(s: string): number {
  const ds = [...s].map(Number);
  return Math.max(...ds) - Math.min(...ds);
}
function totalDeviation(a: string, b: string): number {
  let v = 0;
  for (let i = 0; i < a.length; i++) v += Math.abs(+a[i] - +b[i]);
  return v;
}
function thermometerTier(diff: number): number {
  const d = Math.abs(diff);
  if (d <= 1) return 0;
  if (d <= 3) return 1;
  return 2;
}

const CMP_LABEL: Record<"lt" | "eq" | "gt", string> = {
  lt: "less than",
  eq: "equal to",
  gt: "greater than",
};

/** For a single (guess, result) tuple from the puzzle history, return a
 *  short sentence explaining how `wrongGuess` violates that clue — or
 *  null if `wrongGuess` is consistent with it. */
function explainViolation(
  historyGuess: string,
  result: ClueResult,
  wrongGuess: string,
): string | null {
  const clue = getClueById(result.kind);
  const name = clue.name;

  switch (result.kind) {
    case "bullseyes": {
      const bad: number[] = [];
      for (let i = 0; i < wrongGuess.length; i++) {
        const matches = wrongGuess[i] === historyGuess[i];
        if (matches !== result.hits[i]) bad.push(i);
      }
      if (bad.length === 0) return null;
      const slot = bad[0] + 1;
      const wantsMatch = result.hits[bad[0]];
      return wantsMatch
        ? `${name} said position ${slot} is ${historyGuess[bad[0]]} — your guess has ${wrongGuess[bad[0]]}.`
        : `${name} said position ${slot} is NOT ${historyGuess[bad[0]]} — your guess has ${wrongGuess[bad[0]]}.`;
    }
    case "higherLower": {
      for (let i = 0; i < wrongGuess.length; i++) {
        const t = +wrongGuess[i];
        const g = +historyGuess[i];
        const want = result.cmp[i];
        const ok =
          (want === "eq" && t === g) ||
          (want === "lt" && t < g) ||
          (want === "gt" && t > g);
        if (!ok) {
          const word =
            want === "eq"
              ? `equal to ${g}`
              : want === "lt"
                ? `lower than ${g}`
                : `higher than ${g}`;
          return `${name} said position ${i + 1} should be ${word} — your guess has ${t}.`;
        }
      }
      return null;
    }
    case "within2": {
      for (let i = 0; i < wrongGuess.length; i++) {
        const diff = Math.abs(+wrongGuess[i] - +historyGuess[i]);
        const within = diff <= 2;
        if (within !== result.mask[i]) {
          return result.mask[i]
            ? `${name} said position ${i + 1} should be within 2 of ${historyGuess[i]} — your ${wrongGuess[i]} is off by ${diff}.`
            : `${name} said position ${i + 1} should be more than 2 away from ${historyGuess[i]} — your ${wrongGuess[i]} is only off by ${diff}.`;
        }
        if (result.exact && (diff === 0) !== result.exact[i]) {
          return result.exact[i]
            ? `${name} said position ${i + 1} should exactly match ${historyGuess[i]} — your guess has ${wrongGuess[i]}.`
            : `${name} said position ${i + 1} should not exactly match ${historyGuess[i]} — your guess does.`;
        }
      }
      return null;
    }
    case "parityMask": {
      // Per-slot mask: parity match at each slot must agree between
      // the recorded result and (historyGuess vs hypothesized
      // wrongGuess-as-target).
      for (let i = 0; i < wrongGuess.length; i++) {
        const expected = +wrongGuess[i] % 2 === +historyGuess[i] % 2;
        if (expected !== result.matches[i]) {
          return result.matches[i]
            ? `${name} said slot ${i + 1} parity matches ${historyGuess[i]} — target digit at slot ${i + 1} would be different parity.`
            : `${name} said slot ${i + 1} parity does NOT match ${historyGuess[i]} — target digit at slot ${i + 1} would have to share parity.`;
        }
      }
      return null;
    }
    case "oracle": {
      if (wrongGuess[result.slot] === String(result.digit)) return null;
      return `Oracle revealed position ${result.slot + 1} is ${result.digit} — your guess has ${wrongGuess[result.slot]}.`;
    }
    case "thermometer": {
      for (let i = 0; i < wrongGuess.length; i++) {
        const tier = thermometerTier(+wrongGuess[i] - +historyGuess[i]);
        if (tier !== result.tier[i]) {
          const labels = ["0-1 off", "2-3 off", "4+ off"];
          return `${name} said position ${i + 1} should be ${labels[result.tier[i]]} from ${historyGuess[i]} — your ${wrongGuess[i]} is ${labels[tier]}.`;
        }
      }
      return null;
    }
    case "sumDelta": {
      const want = digitSum(historyGuess) + result.delta;
      const got = digitSum(wrongGuess);
      if (got === want) return null;
      return `${name} said the target's digit sum is ${want} — your guess sums to ${got}.`;
    }
    case "digitOverlap": {
      // Mask-based: result.mask[i] says historyGuess[i] does/doesn't
      // hit a still-available copy in target. Recompute the mask
      // against the hypothesized wrongGuess and compare slot-by-slot.
      const remaining = new Map<string, number>();
      for (const ch of wrongGuess)
        remaining.set(ch, (remaining.get(ch) ?? 0) + 1);
      for (let i = 0; i < historyGuess.length; i++) {
        const ch = historyGuess[i];
        const left = remaining.get(ch) ?? 0;
        const actuallyHit = left > 0;
        if (actuallyHit) remaining.set(ch, left - 1);
        if (actuallyHit !== result.mask[i]) {
          return result.mask[i]
            ? `${name} said ${ch} at slot ${i + 1} hits a target digit — your guess has no remaining ${ch} to match.`
            : `${name} said ${ch} at slot ${i + 1} does NOT hit a target digit — your guess still has a free ${ch}.`;
        }
      }
      return null;
    }
    case "statSummary": {
      // Combined median + range cmp. Reject the candidate target if
      // EITHER axis disagrees with the recorded result.
      const tm = medianValue(wrongGuess);
      const gm = medianValue(historyGuess);
      const gotMedian: "lt" | "eq" | "gt" =
        tm === gm ? "eq" : tm > gm ? "gt" : "lt";
      if (gotMedian !== result.medianCmp) {
        return `${name} said the target's median is ${CMP_LABEL[result.medianCmp]} ${gm} — your guess has median ${tm}.`;
      }
      const tr = digitRange(wrongGuess);
      const gr = digitRange(historyGuess);
      const gotRange: "lt" | "eq" | "gt" =
        tr === gr ? "eq" : tr > gr ? "gt" : "lt";
      if (gotRange !== result.rangeCmp) {
        return `${name} said the target's digit range is ${CMP_LABEL[result.rangeCmp]} ${gr} — your guess has range ${tr}.`;
      }
      return null;
    }
    case "digitClass": {
      // Three counts: even / prime / dice. Reject if any axis disagrees.
      const te = evenCount(wrongGuess);
      const ge = evenCount(historyGuess);
      const gotEven: "lt" | "eq" | "gt" =
        te === ge ? "eq" : te > ge ? "gt" : "lt";
      if (gotEven !== result.evenCmp) {
        return `${name} said the target's even-digit count is ${CMP_LABEL[result.evenCmp]} ${ge} — your guess has ${te} even.`;
      }
      const tp = primeDigitCount(wrongGuess);
      const gp = primeDigitCount(historyGuess);
      const gotPrime: "lt" | "eq" | "gt" =
        tp === gp ? "eq" : tp > gp ? "gt" : "lt";
      if (gotPrime !== result.primeCmp) {
        return `${name} said the target's prime-digit count is ${CMP_LABEL[result.primeCmp]} ${gp} — your guess has ${tp} prime.`;
      }
      const td = diceDigitCount(wrongGuess);
      const gd = diceDigitCount(historyGuess);
      const gotDice: "lt" | "eq" | "gt" =
        td === gd ? "eq" : td > gd ? "gt" : "lt";
      if (gotDice !== result.diceCmp) {
        return `${name} said the target's dice-digit count (1-6) is ${CMP_LABEL[result.diceCmp]} ${gd} — your guess has ${td} in 1-6.`;
      }
      return null;
    }
    case "containsDigit": {
      // Slot-based picks: each pick is { slot, digit, present, exact }.
      // Simulate the same picks against the hypothesized target
      // (wrongGuess) and bail out at the first slot whose
      // present/exact flags don't match the recorded result.
      const remaining = new Map<number, number>();
      for (const ch of wrongGuess) {
        const d = Number(ch);
        remaining.set(d, (remaining.get(d) ?? 0) + 1);
      }
      for (const p of result.picks) {
        const remainingForDigit = remaining.get(p.digit) ?? 0;
        let actualPresent = false;
        let actualExact = false;
        if (remainingForDigit > 0) {
          actualPresent = true;
          actualExact = Number(wrongGuess[p.slot]) === p.digit;
          remaining.set(p.digit, remainingForDigit - 1);
        }
        if (actualPresent !== p.present || actualExact !== p.exact) {
          return `${name} reported a different result at slot ${p.slot + 1} for digit ${p.digit}.`;
        }
      }
      return null;
    }
    case "distinctDigits": {
      const got = new Set(wrongGuess).size;
      if (got === result.count) return null;
      return `${name} said the target uses ${result.count} distinct digit${result.count === 1 ? "" : "s"} — your guess uses ${got}.`;
    }
    case "divisibleBy": {
      // Recompute target's 2-9 divisors against the hypothesized
      // wrongGuess and intersect with historyGuess's divisors. The
      // shared list and "any divisor" flag should both match.
      const divs = [2, 3, 4, 5, 6, 7, 8, 9];
      const wrongTargetDivisors = divs.filter(
        (d) => Number(wrongGuess) % d === 0,
      );
      const historyGuessDivisors = new Set(
        divs.filter((d) => Number(historyGuess) % d === 0),
      );
      const expectedShared = wrongTargetDivisors.filter((d) =>
        historyGuessDivisors.has(d),
      );
      if (
        expectedShared.length === result.divisors.length &&
        expectedShared.every((d, i) => d === result.divisors[i])
      ) {
        return null;
      }
      return `${name} said the shared 2-9 divisors are ${result.divisors.length > 0 ? result.divisors.join(", ") : "(none)"} — your guess gives ${expectedShared.length > 0 ? expectedShared.join(", ") : "(none)"}.`;
    }
    case "totalDeviation": {
      const got = totalDeviation(historyGuess, wrongGuess);
      if (got === result.value) return null;
      return `${name} said the per-slot deviation from ${historyGuess} should sum to ${result.value} — your guess sums to ${got}.`;
    }
    case "upsAndDowns": {
      const t = directionRuns(wrongGuess);
      const g = directionRuns(historyGuess);
      const got: "lt" | "eq" | "gt" =
        t === g ? "eq" : t > g ? "gt" : "lt";
      if (got === result.cmp) return null;
      return `${name} said the target's direction-change count is ${CMP_LABEL[result.cmp]} ${g} — your guess has ${t}.`;
    }
    case "bullseyeTrend":
      // Trend clues compare the current guess to a PRIOR guess. The
      // explainer here only sees a single history guess, not its
      // predecessor, so we can't check the trend invariant. Treated
      // as un-violatable. Captured deduction puzzles predate this
      // clue and won't carry bullseyeTrend results anyway.
      return null;
    case "elimination": {
      // Inverse of Echo. mask[i]=true means historyGuess[i] is NOT in
      // target. So if wrongGuess were the target, historyGuess[i]
      // should be absent iff the recorded mask says so.
      for (let i = 0; i < historyGuess.length; i++) {
        const wantAbsent = result.mask[i];
        const actuallyAbsent = !wrongGuess.includes(historyGuess[i]);
        if (wantAbsent !== actuallyAbsent) {
          return wantAbsent
            ? `${name} said ${historyGuess[i]} is NOT in the target — your guess has at least one ${historyGuess[i]}.`
            : `${name} said ${historyGuess[i]} appears somewhere in the target — your guess has no ${historyGuess[i]}.`;
        }
      }
      return null;
    }
    case "extraLock":
    case "clueReuse":
      // Special clues don't reveal target info, so they can't be violated.
      return null;
  }
}

/** Return one short sentence per clue that the player's guess violates.
 *  Empty array means the player's guess is consistent with every clue
 *  (which can only happen if the guess is the target). */
export function explainWrongGuess(
  puzzle: DeductionPuzzle,
  wrongGuess: string,
): string[] {
  const out: string[] = [];
  for (const g of puzzle.guesses) {
    const msg = explainViolation(g.guess, g.result, wrongGuess);
    if (msg) out.push(msg);
  }
  return out;
}
