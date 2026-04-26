import { NextResponse } from "next/server";
import { getDailyStore } from "@/lib/api/dailyStore";
import { todayUtcISO } from "@/lib/game/targetGenerator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate",
  "cdn-cache-control": "no-store",
};

/**
 * GET /api/debug/leaderboard?date=YYYY-MM-DD
 *
 * Diagnostic endpoint for the daily leaderboard pipeline. Reports:
 *   - which store backend is actually in use ("d1" or "memory")
 *   - whether each CF_* env var is present (booleans only — never the
 *     values themselves)
 *   - the live aggregate for the requested date (defaults to today)
 *
 * If `storeKind` says "memory" in production, the D1 env vars aren't
 * being read by the running function — every player's submission lands
 * in a per-instance Map that no other instance can see, and reloads
 * appear to "lose" each other's results.
 *
 * If `storeKind` is "d1" but `aggregate.total` doesn't match the row
 * count visible in the D1 console, the issue is elsewhere (caching,
 * deployment skew, etc.).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayUtcISO();
  const store = getDailyStore();
  let aggregate: unknown = null;
  let aggregateError: string | null = null;
  try {
    aggregate = await store.aggregate(date);
  } catch (e) {
    aggregateError = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(
    {
      date,
      storeKind: store.kind,
      env: {
        hasAccountId: Boolean(process.env.CF_ACCOUNT_ID),
        hasDatabaseId: Boolean(process.env.CF_D1_DATABASE_ID),
        hasApiToken: Boolean(process.env.CF_D1_API_TOKEN),
      },
      aggregate,
      aggregateError,
      issuedAt: Date.now(),
    },
    { headers: NO_STORE_HEADERS },
  );
}
