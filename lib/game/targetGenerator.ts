import { seededRng } from "./seededRng";

export const DEFAULT_DIGITS = 5;

/** Generate a deterministic target for a given date (YYYY-MM-DD). */
export function generateDailyTarget(
  dateISO: string,
  digits = DEFAULT_DIGITS,
): string {
  const rng = seededRng(`daily:${dateISO}:${digits}`);
  return randomDigitString(digits, rng);
}

/** Generate a fresh random target (unlimited mode). */
export function generateRandomTarget(digits = DEFAULT_DIGITS): string {
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
