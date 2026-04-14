import { NextResponse } from "next/server";
import { generateDailyTarget, todayUtcISO } from "@/lib/game/targetGenerator";
import { getDailyStore } from "@/lib/api/dailyStore";

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** GET /api/daily/[date] — returns puzzle metadata (never the target). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!isValidISODate(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  const today = todayUtcISO();
  if (date > today) {
    return NextResponse.json({ error: "future_date" }, { status: 400 });
  }
  // Lazy-generate to warm internal state / verify solvability.
  generateDailyTarget(date, 5);
  const aggregate = await getDailyStore().aggregate(date);
  return NextResponse.json({
    date,
    digits: 5,
    maxGuesses: 8,
    aggregate,
    issuedAt: Date.now(),
  });
}
