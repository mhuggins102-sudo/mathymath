"use client";

export type DigitState = "idle" | "match" | "close" | "warm" | "cool" | "cold" | "hint" | "entering";

interface DigitProps {
  value: string | null;
  size?: "sm" | "md" | "lg";
  state?: DigitState;
  animate?: boolean;
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
};

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "h-9 w-8 text-lg",
  md: "h-10 w-9 text-lg",
  // "lg" is the in-game row size. Perfect-square cells so 8 rows + keypad
  // comfortably fit on a typical phone without vertical scrolling.
  lg: "h-10 w-10 text-xl sm:h-11 sm:w-11 sm:text-2xl",
};

export function Digit({
  value,
  size = "md",
  state = "idle",
  animate = false,
}: DigitProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md border font-mono font-semibold ${SIZE_CLASS[size]} ${STATE_CLASS[state]} ${
        animate ? "pop" : ""
      }`}
    >
      {value ?? ""}
    </div>
  );
}
