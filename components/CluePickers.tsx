"use client";

import { memo } from "react";
import type { ClueId } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { Digit, type DigitState } from "./Digit";

export interface SlotPick {
  slot: number;
  digit: number;
  present: boolean;
  exact: boolean;
}

/**
 * Slot picker — appears after the player chooses Contains Digit. The
 * player's guess is rendered as tappable cells; tapping a slot tests
 * the digit at that slot against the target's remaining multiset.
 * Cells flip to their result color (green = exact-slot match, yellow
 * = digit present elsewhere, red = digit absent). Already-picked
 * slots become non-tappable. The round ends on a red pick or once
 * every slot has been picked.
 */
function SlotPickerImpl({
  guess,
  picks,
  onPick,
  onCancel,
  busy,
}: {
  guess: string;
  picks: SlotPick[];
  onPick: (slot: number) => void;
  onCancel: () => void;
  /** Disable taps while a pick is in flight (daily mode awaits the
   *  server response before the next pick). */
  busy?: boolean;
}) {
  const pickBySlot = new Map<number, SlotPick>();
  for (const p of picks) pickBySlot.set(p.slot, p);
  const lastWrong =
    picks.length > 0 && picks[picks.length - 1].present === false;
  const allPicked = picks.length >= guess.length;
  const stateFor = (slot: number): DigitState => {
    const p = pickBySlot.get(slot);
    if (!p) return "idle";
    if (p.exact) return "match";
    if (p.present) return "warm";
    return "cold";
  };
  return (
    <div className="w-full max-w-md mx-auto select-none text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
        {picks.length === 0
          ? "Tap a slot in your guess"
          : lastWrong || allPicked
            ? "Round ending…"
            : "Tap another slot — or wait for the round to wrap"}
      </p>
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-3">
        {Array.from(guess).map((ch, i) => {
          const picked = pickBySlot.has(i);
          const tappable = !picked && !busy && !lastWrong && !allPicked;
          return (
            <Digit
              key={i}
              value={ch}
              size="lg"
              state={stateFor(i)}
              animate={picked}
              onClick={tappable ? () => onPick(i) : undefined}
              ariaLabel={tappable ? `Test slot ${i + 1} (digit ${ch})` : undefined}
            />
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
 */
function ReusePickerImpl({
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

/**
 * Memoized to skip re-renders during unrelated keystroke / lock state
 * updates in the parent. Callers should ensure the `picks` and
 * `usedClueIds` array references are stable across renders (see
 * useMemo in app/unlimited/page.tsx) for the shallow compare to skip
 * work rather than just delay it.
 */
export const SlotPicker = memo(SlotPickerImpl);
export const ReusePicker = memo(ReusePickerImpl);
