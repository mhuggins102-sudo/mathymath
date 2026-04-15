import type { ClueResult } from "./clues/types";

/**
 * "Certain" digits: slots whose target value the player can know with
 * certainty from past resolved clues. Four sources reveal per-slot
 * certainty:
 *
 *   - Bullseyes: every slot where hits[i] === true (the player's
 *     guess[i] is literally the target digit at that slot).
 *   - Higher or Lower: slots where cmp[i] === "eq" (same mechanism).
 *   - Thermometer: slots where tier[i] === 0 (exact).
 *   - Oracle: the revealed slot, with its digit.
 *
 * Other positional clues (Within 2, Parity Mask) only narrow a range
 * and do not reveal the digit. Compositional clues never reveal a
 * specific slot.
 *
 * The returned array has length `digits`; entries are the known digit
 * (single char "0".."9") or null for slots that remain uncertain.
 */
export function deriveCertainDigits(
  guesses: readonly {
    guess: string;
    clueId?: string;
    result?: ClueResult;
  }[],
  digits: number,
): (string | null)[] {
  const out: (string | null)[] = new Array(digits).fill(null);
  for (const g of guesses) {
    const r = g.result;
    if (!r) continue;
    switch (r.kind) {
      case "bullseyes":
        for (let i = 0; i < digits; i++) {
          if (r.hits[i]) out[i] = g.guess[i] ?? null;
        }
        break;
      case "higherLower":
        for (let i = 0; i < digits; i++) {
          if (r.cmp[i] === "eq") out[i] = g.guess[i] ?? null;
        }
        break;
      case "thermometer":
        for (let i = 0; i < digits; i++) {
          if (r.tier[i] === 0) out[i] = g.guess[i] ?? null;
        }
        break;
      case "oracle":
        // Oracle reveals the actual target digit at its slot regardless
        // of what the player guessed there.
        if (r.slot >= 0 && r.slot < digits) {
          out[r.slot] = String(r.digit);
        }
        break;
      default:
        break;
    }
  }
  return out;
}

/** How many slots are currently certain. */
export function certainCount(certain: readonly (string | null)[]): number {
  let n = 0;
  for (const c of certain) if (c !== null) n++;
  return n;
}

/**
 * Interleave the player's typed input with the known certain digits to
 * produce the full-length guess string. The player's `input` contains
 * only the digits they've typed into the non-certain slots, in order,
 * so this walks slots left-to-right and pulls from `input` whenever the
 * slot is not certain. Returns a string of length up to `certain.length`
 * — shorter if the input has not yet filled every non-certain slot.
 */
export function buildGuessFromInput(
  certain: readonly (string | null)[],
  input: string,
): string {
  let out = "";
  let idx = 0;
  for (let i = 0; i < certain.length; i++) {
    const c = certain[i];
    if (c !== null) {
      out += c;
    } else {
      const ch = input[idx++];
      if (ch === undefined) return out;
      out += ch;
    }
  }
  return out;
}

/** Convenience: the max length the typed `input` string can grow to
 *  given the current certain overlay. */
export function inputCapacity(
  certain: readonly (string | null)[],
): number {
  return certain.length - certainCount(certain);
}
