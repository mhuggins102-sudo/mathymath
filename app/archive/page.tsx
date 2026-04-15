"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function ymToIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function firstWeekday(year: number, month: number): number {
  // 0 = Sunday
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

const LAUNCH = { year: 2026, month: 3 }; // April 2026 (month is 0-indexed)

export default function ArchivePage() {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const [view, setView] = useState({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth(),
  });

  const playedSet = useMemo(() => {
    if (typeof window === "undefined") return new Set<string>();
    const out = new Set<string>();
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("mathymath:daily:")) {
        out.add(k.replace("mathymath:daily:", ""));
      }
    }
    return out;
  }, []);

  const canGoBack =
    view.year > LAUNCH.year ||
    (view.year === LAUNCH.year && view.month > LAUNCH.month);
  const canGoForward =
    view.year < now.getUTCFullYear() ||
    (view.year === now.getUTCFullYear() && view.month < now.getUTCMonth());

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month + delta, 1));
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  const numDays = daysInMonth(view.year, view.month);
  const leading = firstWeekday(view.year, view.month);

  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) {
    cells.push({ iso: ymToIso(view.year, view.month, d), day: d });
  }

  const monthLabel = new Date(Date.UTC(view.year, view.month, 1)).toLocaleString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-4 pb-8">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-muted text-sm hover:text-foreground">
          ← home
        </Link>
        <h1 className="text-sm uppercase tracking-wider text-muted">Archive</h1>
        <span className="text-sm text-muted w-12" />
      </header>

      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          className="text-muted px-3 py-1 disabled:opacity-30"
          aria-label="Previous month"
        >
          ◀
        </button>
        <h2 className="font-semibold">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!canGoForward}
          className="text-muted px-3 py-1 disabled:opacity-30"
          aria-label="Next month"
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted mb-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const future = c.iso > todayIso;
          const preLaunch =
            view.year < LAUNCH.year ||
            (view.year === LAUNCH.year && view.month < LAUNCH.month);
          const disabled = future || preLaunch;
          const played = playedSet.has(c.iso);
          const isToday = c.iso === todayIso;
          // min-h-11 + min-w-11 keeps every cell at the WCAG 2.5.5 / Apple
          // HIG 44px minimum tap target even at 360px viewport width where
          // aspect-square alone renders cells around 43px.
          const cls = [
            "aspect-square min-h-11 min-w-11 rounded-md flex items-center justify-center text-sm font-mono",
            disabled ? "text-muted/40 bg-surface" : "bg-surface-2 hover:bg-surface-2/80",
            isToday ? "ring-2 ring-accent" : "",
            played ? "text-good" : "",
          ].join(" ");
          if (disabled) {
            return (
              <div key={i} className={cls}>
                {c.day}
              </div>
            );
          }
          return (
            <Link key={i} href={`/daily/${c.iso}`} className={cls}>
              {c.day}
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted text-center mt-6">
        Green dates are ones you&apos;ve played. Ringed date is today.
      </p>
    </main>
  );
}
