"use client";

import { useEffect, useState } from "react";

/** Milliseconds until the next UTC midnight. */
export function msUntilNextUtcMidnight(now = Date.now()): number {
  const d = new Date(now);
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return next - now;
}

export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useCountdown(): string {
  const [label, setLabel] = useState(() => formatHMS(msUntilNextUtcMidnight()));
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setLabel(formatHMS(msUntilNextUtcMidnight()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return label;
}
