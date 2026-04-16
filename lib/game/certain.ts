import type { ClueResult } from "./clues/types";
import type { LockRecord } from "./locks";

/**
 * "Certain" digits: slots whose target value the player can know with
 * certainty. Five sources reveal per-slot certainty:
 *
 *   - Bullseyes: every slot where hits[i] === true (the player's
 *     guess[i] is literally the target digit at that slot).
 *   - Higher or Lower: slots where cmp[i] === "eq" (same mechanism).
 *   - Thermometer: slots where tier[i] === 0 (exact).
 *   - Oracle: the revealed slot, with its digit.
 *   - Correctly-resolved locks from past guesses: if the player locked
 *     `digit` at `slot` and it resolved correct, target[slot] = digit.
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
    locks?: readonly LockRecord[];
  }[],
  digits: number,
): (string | null)[] {
  const out: (string | null)[] = new Array(digits).fill(null);
  for (const g of guesses) {
    // Clue-driven reveals.
    const r = g.result;
    if (r) {
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
        case "within2":
        // `exact` was added later; old saved-game data may omit it.
        if (r.exact) {
          for (let i = 0; i < digits; i++) {
            if (r.exact[i]) out[i] = g.guess[i] ?? null;
          }
        }
        break;
      case "thermometer":
          for (let i = 0; i < digits; i++) {
            if (r.tier[i] === 0) out[i] = g.guess[i] ?? null;
          }
          break;
        case "oracle":
          if (r.slot >= 0 && r.slot < digits) {
            out[r.slot] = String(r.digit);
          }
          break;
        default:
          break;
      }
    }
    // Lock-driven reveals: a correct lock pins target[slot] = digit.
    for (const lock of g.locks ?? []) {
      if (lock.correct && lock.slot >= 0 && lock.slot < digits) {
        out[lock.slot] = lock.digit;
      }
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

/** Indices of slots whose target digit is known — derived from the same
 *  sources as deriveCertainDigits. Used to pass into Clue.compute as
 *  context.knownSlots (so Oracle can avoid re-revealing). */
export function knownSlotsFromHistory(
  guesses: Parameters<typeof deriveCertainDigits>[0],
  digits: number,
): number[] {
  const certain = deriveCertainDigits(guesses, digits);
  const out: number[] = [];
  for (let i = 0; i < certain.length; i++) {
    if (certain[i] !== null) out.push(i);
  }
  return out;
}
