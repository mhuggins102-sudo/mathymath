"use client";

export type DigitState =
  | "idle"
  | "match"
  | "close"
  | "warm"
  | "cool"
  | "cold"
  | "hint"
  | "entering"
  // "locked-pending": cell is currently selected for lock entry OR has
  // a committed lock whose correctness hasn't resolved yet. Distinct
  // from `entering` so the lock workflow reads visually.
  | "locked-pending";

/** Optional corner badge overlay — used by the lock mechanic to mark
 *  a cell that was locked this turn, with correctness resolved on
 *  submit. "pending" is pre-submit; "correct" / "wrong" are post-submit. */
export type DigitBadge = "lock-pending" | "lock-correct" | "lock-wrong";

interface DigitProps {
  value: string | null;
  size?: "sm" | "md" | "lg";
  state?: DigitState;
  animate?: boolean;
  badge?: DigitBadge;
  /** Draws a thicker ring around the cell — used to highlight the slot
   *  that is currently in lock-entry mode. */
  selected?: boolean;
  /** If provided, the cell becomes tappable (button). The consumer
   *  passes a handler that typically enters/exits lock-entry mode. */
  onClick?: () => void;
  /** Accessible label when `onClick` is set. */
  ariaLabel?: string;
}

const STATE_CLASS: Record<DigitState, string> = {
  idle: "border-border bg-surface text-foreground",
  entering: "border-accent/60 bg-surface-2 text-foreground",
  match: "border-good/70 bg-good/20 text-good",
  close: "border-close/70 bg-close/15 text-close",
  warm: "border-warn/70 bg-warn/20 text-warn",
  cool: "border-cool/70 bg-cool/20 text-cool",
  cold: "border-bad/70 bg-bad/20 text-bad",
  hint: "border-warn/50 bg-warn/10 text-foreground",
  "locked-pending": "border-accent/80 bg-accent/15 text-foreground",
};

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "h-9 w-8 text-lg",
  md: "h-10 w-9 text-lg",
  // "lg" is the in-game row size. Perfect-square cells so 8 rows + keypad
  // comfortably fit on a typical phone without vertical scrolling.
  lg: "h-10 w-10 text-xl sm:h-11 sm:w-11 sm:text-2xl",
};

const BADGE_CLASS: Record<DigitBadge, string> = {
  // Pending: muted gray, no correctness signal yet.
  "lock-pending": "text-muted",
  // Correct: green, matches the cell's success bg.
  "lock-correct": "text-good",
  // Wrong: red/magenta-in-CB so the lock itself reads as "spent".
  // (Previously drew an ✕ overlay — the user reported the X was too
  // small to see against the emoji lock; now the icon IS the signal.)
  "lock-wrong": "text-bad",
};

/** Small inline padlock used as a corner badge on locked cells.
 *  Rendered in `currentColor` so its fill follows the parent's
 *  `text-good` / `text-bad` / `text-muted` token. Swapped in for the
 *  🔒 emoji so we can actually color it — emoji are full-color and
 *  don't respect `color` under any reliable filter across platforms. */
function LockBadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2a5 5 0 0 0-5 5v3H5.5A1.5 1.5 0 0 0 4 11.5v9A1.5 1.5 0 0 0 5.5 22h13a1.5 1.5 0 0 0 1.5-1.5v-9a1.5 1.5 0 0 0-1.5-1.5H17V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3zm0 10a1.5 1.5 0 0 1 1 2.6V18h-2v-1.4a1.5 1.5 0 0 1 1-2.6z" />
    </svg>
  );
}

export function Digit({
  value,
  size = "md",
  state = "idle",
  animate = false,
  badge,
  selected,
  onClick,
  ariaLabel,
}: DigitProps) {
  const className = `relative inline-flex items-center justify-center rounded-md border font-mono font-semibold ${SIZE_CLASS[size]} ${STATE_CLASS[state]} ${
    animate ? "pop" : ""
  } ${selected ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : ""}`;

  const content = (
    <>
      {value ?? ""}
      {badge && (
        <span
          className={`pointer-events-none absolute -top-1 -right-1 ${BADGE_CLASS[badge]}`}
          aria-hidden
        >
          <LockBadgeIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
