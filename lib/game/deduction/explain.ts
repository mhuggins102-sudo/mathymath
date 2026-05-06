import { getClueById } from "@/lib/game/clues/registry";
import type { ClueResult } from "@/lib/game/clues/types";
import { medianValue } from "@/lib/game/clues/median";
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
function digitOverlap(guess: string, target: string): number {
  const remaining = new Array(10).fill(0);
  for (const ch of target) remaining[+ch]++;
  let count = 0;
  for (const ch of guess) {
    const d = +ch;
    if (remaining[d] > 0) {
      count++;
      remaining[d]--;
    }
  }
  return count;
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
      // Count-only after the bandwidth nerf: compare totals rather
      // than pinpointing slots.
      let count = 0;
      for (let i = 0; i < wrongGuess.length; i++) {
        if (+wrongGuess[i] % 2 === +historyGuess[i] % 2) count++;
      }
      if (count !== result.count) {
        return `${name} said ${result.count} slots should share parity with ${historyGuess} — your guess matches ${count}.`;
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
      const got = digitOverlap(historyGuess, wrongGuess);
      if (got === result.count) return null;
      return `${name} said ${result.count} digit${result.count === 1 ? "" : "s"} of ${historyGuess} should appear in the target — your guess matches on ${got}.`;
    }
    case "parityBalance": {
      const t = evenCount(wrongGuess);
      const g = evenCount(historyGuess);
      const got: "lt" | "eq" | "gt" =
        t === g ? "eq" : t > g ? "gt" : "lt";
      if (got === result.cmp) return null;
      return `${name} said the target's even-digit count is ${CMP_LABEL[result.cmp]} ${g} — your guess has ${t} even.`;
    }
    case "primeCount": {
      const t = primeDigitCount(wrongGuess);
      const g = primeDigitCount(historyGuess);
      const got: "lt" | "eq" | "gt" =
        t === g ? "eq" : t > g ? "gt" : "lt";
      if (got === result.cmp) return null;
      return `${name} said the target's prime-digit count is ${CMP_LABEL[result.cmp]} ${g} — your guess has ${t} prime.`;
    }
    case "rangeCompare": {
      const t = digitRange(wrongGuess);
      const g = digitRange(historyGuess);
      const got: "lt" | "eq" | "gt" =
        t === g ? "eq" : t > g ? "gt" : "lt";
      if (got === result.cmp) return null;
      return `${name} said the target's digit range (max−min) is ${CMP_LABEL[result.cmp]} ${g} — your guess has range ${t}.`;
    }
    case "containsDigit": {
      const has = wrongGuess.includes(String(result.digit));
      if (has === result.present) return null;
      return result.present
        ? `${name} said the target contains a ${result.digit} — your guess has none.`
        : `${name} said the target does NOT contain ${result.digit} — your guess has one.`;
    }
    case "distinctDigits": {
      const got = new Set(wrongGuess).size;
      if (got === result.count) return null;
      return `${name} said the target uses ${result.count} distinct digit${result.count === 1 ? "" : "s"} — your guess uses ${got}.`;
    }
    case "median": {
      const t = medianValue(wrongGuess);
      const g = medianValue(historyGuess);
      const got: "lt" | "eq" | "gt" =
        t === g ? "eq" : t > g ? "gt" : "lt";
      if (got === result.cmp) return null;
      return `${name} said the target's median digit is ${CMP_LABEL[result.cmp]} ${g} — your guess has median ${t}.`;
    }
    case "divisibleBy": {
      if (result.present && result.divisor !== null) {
        if (Number(wrongGuess) % result.divisor === 0) return null;
        return `${name} said the target is divisible by ${result.divisor} — your guess is not.`;
      }
      // No divisor 2-9 splits the target evenly.
      const divisors = [2, 3, 4, 5, 6, 7, 8, 9];
      const matches = divisors.filter((d) => Number(wrongGuess) % d === 0);
      if (matches.length === 0) return null;
      return `${name} said no value 2–9 divides the target — your guess is divisible by ${matches.join(", ")}.`;
    }
    case "totalDeviation": {
      const got = totalDeviation(historyGuess, wrongGuess);
      if (got === result.value) return null;
      return `${name} said the per-slot deviation from ${historyGuess} should sum to ${result.value} — your guess sums to ${got}.`;
    }
    case "diceCount": {
      const t = diceDigitCount(wrongGuess);
      const g = diceDigitCount(historyGuess);
      const got: "lt" | "eq" | "gt" =
        t === g ? "eq" : t > g ? "gt" : "lt";
      if (got === result.cmp) return null;
      return `${name} said the target's dice-digit count (1–6) is ${CMP_LABEL[result.cmp]} ${g} — your guess has ${t} in 1–6.`;
    }
    case "upsAndDowns": {
      const t = directionRuns(wrongGuess);
      const g = directionRuns(historyGuess);
      const got: "lt" | "eq" | "gt" =
        t === g ? "eq" : t > g ? "gt" : "lt";
      if (got === result.cmp) return null;
      return `${name} said the target's direction-change count is ${CMP_LABEL[result.cmp]} ${g} — your guess has ${t}.`;
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
