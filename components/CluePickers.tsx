"use client";

import type { ClueId } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
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
  compact,
}: {
  digits: number;
  certainDigits: (string | null)[];
  onSelect: (slot: number) => void;
  onCancel: () => void;
  /** Tightens cell sizing to match the 6-digit row layout in the grid. */
  compact?: boolean;
}) {
  return (
    <div className="w-full max-w-md mx-auto select-none text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
        Pick a slot to reveal
      </p>
      <div
        className={`flex items-center justify-center mb-3 ${
          compact ? "gap-1 sm:gap-1.5" : "gap-1.5 sm:gap-2"
        }`}
      >
        {Array.from({ length: digits }, (_, i) => {
          const known = certainDigits[i] !== null;
          const state: DigitState = known ? "match" : "idle";
          return (
            <Digit
              key={i}
              value={known ? certainDigits[i] : null}
              size={compact ? "lg-narrow" : "lg"}
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
        className="text-xs text-muted hover:text-foreground "
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
        className="text-xs text-muted hover:text-foreground "
      >
        cancel — pick a different clue
      </button>
    </div>
  );
}

/**
 * Reuse picker — appears after the player chooses the Clue Reuse
 * special. Shows a list of previously-used non-special clues. Tapping
 * one applies that clue again to the current guess.
 */
export function ReusePicker({
  usedClueIds,
  onSelect,
  onCancel,
}: {
  usedClueIds: readonly ClueId[];
  onSelect: (clueId: ClueId) => void;
  onCancel: () => void;
}) {
  // All previously-used clues are reusable EXCEPT Clue Reuse itself
  // (re-using a re-use is circular). Extra Lock IS reusable — picking
  // it again grants another lock.
  const reusable = usedClueIds.filter((id) => id !== "clueReuse");
  const btn =
    "w-full text-left bg-surface-2 hover:bg-surface-2/80 active:scale-[0.99] transition rounded-lg px-4 py-3 border border-border";
  return (
    <div className="w-full max-w-md mx-auto select-none text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
        Pick a clue to re-use
      </p>
      <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
        {reusable.length === 0 && (
          <p className="text-xs text-muted py-4">
            No reusable clues yet — play another round first.
          </p>
        )}
        {reusable.map((id) => {
          const clue = getClueById(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={btn}
            >
              <span className="font-semibold text-foreground">
                {clue.name}
              </span>
              <span
                className={`ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                  clue.category === "positional"
                    ? "bg-accent/20 text-accent"
                    : clue.category === "compositional"
                    ? "bg-warn/20 text-warn"
                    : "bg-good/20 text-good"
                }`}
              >
                {clue.category}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-3 text-xs text-muted hover:text-foreground "
      >
        cancel — pick a different clue
      </button>
    </div>
  );
}
