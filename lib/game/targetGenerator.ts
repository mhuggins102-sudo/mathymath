import { seededRng } from "./seededRng";

export const DEFAULT_DIGITS = 5;

/**
 * Rejects targets that make the puzzle trivial or unfun:
 *   - all-same (00000, 99999) — distinctDigits trivially reveals it
 *   - strictly monotone (01234, 98765) — range/median/distinct leak strong
 *     signal on one clue
 *   - 4:1 split with only 2 distinct digits (77771) — distinctDigits = 2
 *     reduces the search drastically
 * About 1% of all 5-digit strings fall into these buckets; rejection
 * sampling re-rolls with a continuation seed until a clean target appears.
 */
export function isDegenerateTarget(target: string): boolean {
  const digits = [...target].map(Number);
  const distinct = new Set(digits).size;
  if (distinct === 1) return true;
  if (distinct === 2) {
    // Count occurrences of each digit; 4:1 split is the degenerate shape.
    const counts = new Map<number, number>();
    for (const d of digits) counts.set(d, (counts.get(d) ?? 0) + 1);
    const maxCount = Math.max(...counts.values());
    if (maxCount === digits.length - 1) return true;
  }
  // Strictly monotone (ascending or descending).
  let asc = true;
  let desc = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) asc = false;
    if (digits[i] !== digits[i - 1] - 1) desc = false;
  }
  if (asc || desc) return true;
  return false;
}

/** Generate a deterministic target for a given date (YYYY-MM-DD).
 *  Degenerate candidates are rejected; the seed advances until a clean
 *  target lands, so the output is still fully deterministic per date. */
export function generateDailyTarget(
  dateISO: string,
  digits = DEFAULT_DIGITS,
): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const rng = seededRng(`daily:${dateISO}:${digits}:${attempt}`);
    const candidate = randomDigitString(digits, rng);
    if (!isDegenerateTarget(candidate)) return candidate;
  }
  // Pathologically unlucky — accept the last candidate rather than loop
  // forever. In practice the rejection rate is ~1% so attempt 0 almost
  // always succeeds.
  const rng = seededRng(`daily:${dateISO}:${digits}:fallback`);
  return randomDigitString(digits, rng);
}

/** Generate a fresh random target (unlimited mode). */
export function generateRandomTarget(digits = DEFAULT_DIGITS): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = randomDigitString(digits, Math.random);
    if (!isDegenerateTarget(candidate)) return candidate;
  }
  return randomDigitString(digits, Math.random);
}

export function randomDigitString(
  digits: number,
  rng: () => number = Math.random,
): string {
  let s = "";
  for (let i = 0; i < digits; i++) {
    s += Math.floor(rng() * 10).toString();
  }
  return s;
}

/** Today's UTC date in YYYY-MM-DD. */
export function todayUtcISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
