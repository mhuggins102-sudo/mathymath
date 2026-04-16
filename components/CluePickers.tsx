"use client";

import { Digit, type DigitState } from "./Digit";

/**
 * Slot picker — appears after the player chooses Oracle in the clue
 * chooser. Shows 5 cells; already-known slots are grayed out (not
 * tappable). Tapping an unknown slot confirms the selection.
 */
export function SlotPicker({
  digits,
  certainDigits,
  onSelect,
  onCancel,
}: {
  digits: number;
  certainDigits: (string | null)[];
  onSelect: (slot: number) => void;
  onCancel: () => void;
}) {
  return (
    <div className="w-full max-w-md mx-auto select-none text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
        Pick a slot to reveal
      </p>
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-3">
        {Array.from({ length: digits }, (_, i) => {
          const known = certainDigits[i] !== null;
          const state: DigitState = known ? "match" : "idle";
          return (
            <Digit
              key={i}
              value={known ? certainDigits[i] : String(i + 1)}
              size="lg"
              state={state}
              onClick={known ? undefined : () => onSelect(i)}
              ariaLabel={
                known
                  ? `Slot ${i + 1} already known`
                  : `Reveal slot ${i + 1}`
              }
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-muted hover:text-foreground underline underline-offset-4"
      >
        cancel — pick a different clue
      </button>
    </div>
  );
}

/**
 * Digit picker — appears after the player chooses Contains Digit.
 * Shows buttons 0-9. Tapping one confirms the selection.
 */
export function DigitPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (digit: number) => void;
  onCancel: () => void;
}) {
  const btn =
    "h-12 select-none rounded-md bg-surface-2 text-foreground font-semibold active:scale-95 active:bg-surface transition text-xl";
  return (
    <div className="w-full max-w-md mx-auto select-none text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
        Pick a digit to ask about
      </p>
      <div className="grid grid-cols-5 gap-2 mb-2">
        {[1, 2, 3, 4, 5].map((d) => (
          <button
            key={d}
            type="button"
            className={btn}
            onClick={() => onSelect(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {[6, 7, 8, 9, 0].map((d) => (
          <button
            key={d}
            type="button"
            className={btn}
            onClick={() => onSelect(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-muted hover:text-foreground underline underline-offset-4"
      >
        cancel — pick a different clue
      </button>
    </div>
  );
}
