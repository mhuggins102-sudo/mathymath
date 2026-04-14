export type ValidationResult =
  | { ok: true; digits: string }
  | { ok: false; error: string };

export function validateGuess(raw: string, expectedDigits: number): ValidationResult {
  if (raw.length !== expectedDigits) {
    return { ok: false, error: `Enter ${expectedDigits} digits` };
  }
  if (!/^[0-9]+$/.test(raw)) {
    return { ok: false, error: "Digits only" };
  }
  return { ok: true, digits: raw };
}
