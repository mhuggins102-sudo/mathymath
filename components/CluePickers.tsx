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
 * Multi-pick: shows buttons 0-9, but only the digits still available
 * from the player's current guess (after subtracting prior picks)
 * are enabled. Each correct pick stays the picker open for another
 * round; a wrong pick or an exhausted multiset closes it. Prior
 * picks render along the top with ✓/✗ markers so the player can see
 * what they've spent.
 */
export function DigitPicker({
  picks,
  availableDigits,
  onPick,
  onCancel,
  busy,
}: {
  picks: { digit: number; present: boolean }[];
  availableDigits: number[];
  onPick: (digit: number) => void;
  onCancel: () => void;
  /** Disable buttons while a pick is in flight (daily mode awaits the
   *  server response before the next pick). */
  busy?: boolean;
}) {
  const enabled = new Set(availableDigits);
  const btnBase =
    "h-12 select-none rounded-md font-semibold transition text-xl";
  const btnEnabled = `${btnBase} bg-surface-2 text-foreground active:scale-95 active:bg-surface`;
  const btnDisabled = `${btnBase} bg-surface text-muted/40 cursor-not-allowed`;
  const lastWrong =
    picks.length > 0 && picks[picks.length - 1].present === false;
  return (
    <div className="w-full max-w-md mx-auto select-none text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
        {picks.length === 0
          ? "Pick a digit from your guess"
          : lastWrong
            ? "Wrong — round ending"
            : "Keep picking — or wait for the round to wrap"}
      </p>
      {picks.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2 text-sm font-mono">
          {picks.map((p, i) => (
            <span
              key={i}
              className={p.present ? "text-good" : "text-bad"}
            >
              {p.digit}
              {p.present ? "✓" : "✗"}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-5 gap-2 mb-2">
        {[1, 2, 3, 4, 5].map((d) => {
          const isEnabled = enabled.has(d) && !busy;
          return (
            <button
              key={d}
              type="button"
              className={isEnabled ? btnEnabled : btnDisabled}
              onClick={() => isEnabled && onPick(d)}
              disabled={!isEnabled}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {[6, 7, 8, 9, 0].map((d) => {
          const isEnabled = enabled.has(d) && !busy;
          return (
            <button
              key={d}
              type="button"
              className={isEnabled ? btnEnabled : btnDisabled}
              onClick={() => isEnabled && onPick(d)}
              disabled={!isEnabled}
            >
              {d}
            </button>
          );
        })}
      </div>
      {picks.length === 0 && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted hover:text-foreground "
        >
          cancel — pick a different clue
        </button>
      )}
    </div>
  );
}

/**
 * Reuse picker — appears after the player chooses the Clue Reuse
 * special. Shows a list of previously-used non-special clues. Tapping
 * one applies that clue again to the current guess.
 *
 * In advanced unlimited mode, when the positional cap has been reached,
 * `excludePositional` is true and the pool is filtered to non-positional
 * previously-used clues only — re-applying a positional clue would push
 * the player past the cap, which the rules disallow.
 */
export function ReusePicker({
  usedClueIds,
  onSelect,
  onCancel,
  excludePositional,
}: {
  usedClueIds: readonly ClueId[];
  onSelect: (clueId: ClueId) => void;
  onCancel: () => void;
  excludePositional?: boolean;
}) {
  // All previously-used clues are reusable EXCEPT Clue Reuse itself
  // (re-using a re-use is circular). Extra Lock IS reusable — picking
  // it again grants another lock.
  const reusable = usedClueIds
    .filter((id) => id !== "clueReuse")
    .filter((id) => {
      if (!excludePositional) return true;
      try {
        return getClueById(id).category !== "positional";
      } catch {
        return true;
      }
    });
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
