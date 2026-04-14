"use client";

import { useCountdown } from "@/lib/hooks/useCountdown";

export function Countdown({ label = "Next puzzle in" }: { label?: string }) {
  const hms = useCountdown();
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="font-mono text-2xl text-foreground">{hms}</p>
      <p className="text-[10px] text-muted">UTC midnight</p>
    </div>
  );
}
