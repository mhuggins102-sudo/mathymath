"use client";

import { ReactNode } from "react";

interface DigitProps {
  value: string | null;
  size?: "sm" | "md" | "lg";
  filled?: boolean;
  state?: "idle" | "exact" | "miss" | "hint";
  overlay?: ReactNode;
  animate?: boolean;
}

export function Digit({
  value,
  size = "md",
  filled = false,
  state = "idle",
  overlay,
  animate = false,
}: DigitProps) {
  const sizeClasses =
    size === "lg"
      ? "h-14 w-12 text-3xl sm:h-16 sm:w-14 sm:text-4xl"
      : size === "sm"
      ? "h-9 w-8 text-lg"
      : "h-12 w-11 text-2xl";

  const border =
    state === "exact"
      ? "border-good/80 bg-good/10"
      : state === "miss"
      ? "border-border bg-surface"
      : state === "hint"
      ? "border-warn/60 bg-warn/5"
      : filled
      ? "border-accent/60 bg-surface-2"
      : "border-border bg-surface";

  const colorClass = value ? `digit-${value}` : "text-muted";

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-md border ${sizeClasses} ${border} font-mono font-semibold ${
        animate ? "pop" : ""
      }`}
    >
      <span className={colorClass}>{value ?? ""}</span>
      {overlay}
    </div>
  );
}
