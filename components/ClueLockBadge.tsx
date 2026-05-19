import type { ClueId } from "@/lib/game/clues/types";
import { BONUS_LOCK_CLUE_IDS, CLUE_REUSE_CLUE_ID, CLUE_REUSE_COST } from "@/lib/game/locks";

/**
 * Inline lock-economy hint next to a clue name. Two variants:
 *
 *   - **Bonus** (green): clues that grant +1 🔒 when chosen (the three
 *     compositional bonus-lock clues — Distinct Digits, Ups and Downs,
 *     Divisible By).
 *   - **Cost** (warn/red): Clue Reuse, which spends 🔒 per pick.
 *
 * Returns null for any other clue id so callers can render it
 * unconditionally. `size` lets the chooser use a slightly larger badge
 * than the HelpModal example cards.
 */
export function ClueLockBadge({
  clueId,
  size = "sm",
}: {
  clueId: ClueId;
  size?: "sm" | "xs";
}) {
  const isReuse = clueId === CLUE_REUSE_CLUE_ID;
  const isBonus = BONUS_LOCK_CLUE_IDS.has(clueId);
  if (!isReuse && !isBonus) return null;
  const sizeClass = size === "xs" ? "text-[10px]" : "text-[11px]";
  if (isReuse) {
    return (
      <span
        className={`inline-flex items-center font-normal text-bad ${sizeClass}`}
        title={`Costs ${CLUE_REUSE_COST} 🔒 per pick`}
      >
        −🔒
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center font-normal text-good ${sizeClass}`}
      title="Grants +1 🔒 when chosen"
    >
      +🔒
    </span>
  );
}
