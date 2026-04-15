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

const BADGE_CONTENT: Record<DigitBadge, string> = {
  "lock-pending": "🔒",
  "lock-correct": "🔒",
  "lock-wrong": "🔓",
};

const BADGE_CLASS: Record<DigitBadge, string> = {
  // Pending: muted, no color signal yet.
  "lock-pending": "text-muted/80",
  // Correct: green on light-green dot so it reads against the match bg.
  "lock-correct": "text-foreground",
  // Wrong: red-tinted lock with strike to communicate "lock spent".
  "lock-wrong": "text-bad",
};

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
          className={`pointer-events-none absolute -top-1 -right-1 leading-none text-[9px] sm:text-[10px] ${BADGE_CLASS[badge]}`}
          aria-hidden
        >
          {BADGE_CONTENT[badge]}
          {badge === "lock-wrong" && (
            <span className="absolute inset-0 flex items-center justify-center text-bad font-bold">
              ✕
            </span>
          )}
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
