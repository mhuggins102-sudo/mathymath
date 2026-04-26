/**
 * Cloudflare D1 implementation of DailyStore.
 *
 * Uses the D1 REST API (https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database)
 * so it works regardless of where this Next.js app is deployed —
 * Cloudflare Pages with native bindings is faster, but the HTTP API is
 * simple, portable, and good enough for one daily-puzzle leaderboard.
 *
 * Schema (apply via `scripts/d1-schema.sql`):
 *
 *   CREATE TABLE daily_results (
 *     client_id TEXT NOT NULL,
 *     puzzle_date TEXT NOT NULL,
 *     guess_count INTEGER NOT NULL,
 *     won INTEGER NOT NULL,                 -- 0 / 1
 *     chosen_clues TEXT,                    -- JSON-encoded
 *     duration_ms INTEGER,
 *     created_at INTEGER NOT NULL,          -- Unix ms
 *     PRIMARY KEY (client_id, puzzle_date)
 *   );
 *   CREATE INDEX idx_daily_results_date ON daily_results(puzzle_date);
 *
 * The PK enforces "first submission for a date wins" with INSERT OR
 * IGNORE — replays don't skew percentile or distribution.
 */

import type {
  DailyAggregate,
  DailyResult,
  DailyStore,
} from "./dailyStore";

export interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

interface D1ApiResponse<T> {
  success: boolean;
  errors?: { code?: number; message: string }[];
  result?: { results?: T[]; success?: boolean }[];
}

async function d1Query<T>(
  config: D1Config,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`d1_http_${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as D1ApiResponse<T>;
  if (!body.success) {
    const msg = body.errors?.map((e) => e.message).join("; ") ?? "unknown";
    throw new Error(`d1_error: ${msg}`);
  }
  return body.result?.[0]?.results ?? [];
}

interface DailyResultRow {
  client_id: string;
  guess_count: number;
  won: number;
}

function aggregateRows(rows: readonly DailyResultRow[]): DailyAggregate {
  const agg: DailyAggregate = {
    total: rows.length,
    wins: 0,
    distribution: {},
  };
  for (const r of rows) {
    if (r.won) {
      agg.wins++;
      agg.distribution[r.guess_count] =
        (agg.distribution[r.guess_count] ?? 0) + 1;
    }
  }
  return agg;
}

/** Computes the same "% of others strictly beaten" percentile that the
 *  in-memory store reports. Losses score worse than any win; among wins,
 *  fewer guesses beats more guesses. */
function percentileOf(
  rows: readonly DailyResultRow[],
  myClientId: string,
  myScore: number,
): number {
  let beaten = 0;
  for (const r of rows) {
    if (r.client_id === myClientId) continue;
    const score = r.won ? r.guess_count : 999;
    if (score > myScore) beaten++;
  }
  const denom = Math.max(1, rows.length - 1);
  return Math.round((beaten / denom) * 100);
}

export function createD1DailyStore(config: D1Config): DailyStore {
  return {
    async submit(result: DailyResult) {
      // INSERT OR IGNORE = first write wins, matching the in-memory
      // store's de-dupe semantics. A second submit for the same
      // (client_id, puzzle_date) is a no-op — we report `duplicate: true`
      // and surface the originally-stored row.
      await d1Query(
        config,
        `INSERT OR IGNORE INTO daily_results
           (client_id, puzzle_date, guess_count, won, chosen_clues, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          result.clientId,
          result.puzzleDate,
          result.guessCount,
          result.won ? 1 : 0,
          JSON.stringify(result.chosenClues ?? []),
          result.durationMs ?? null,
          result.createdAt,
        ],
      );

      // Read the player's stored row + the day's full leaderboard in
      // one round-trip-per-statement. (D1's HTTP API doesn't batch, so
      // we accept two requests here for correctness over speed.)
      const stored = await d1Query<DailyResultRow>(
        config,
        `SELECT client_id, guess_count, won
           FROM daily_results
           WHERE client_id = ? AND puzzle_date = ?`,
        [result.clientId, result.puzzleDate],
      );
      const me = stored[0];
      // If me is missing, the INSERT failed silently. Surface it — we
      // can't compute a percentile without our own row.
      if (!me) throw new Error("d1_self_row_missing");

      const all = await d1Query<DailyResultRow>(
        config,
        `SELECT client_id, guess_count, won
           FROM daily_results
           WHERE puzzle_date = ?`,
        [result.puzzleDate],
      );

      const aggregate = aggregateRows(all);
      const myScore = me.won ? me.guess_count : 999;
      const percentile = percentileOf(all, result.clientId, myScore);
      // Duplicate: the row we read back doesn't match the one we tried
      // to insert (the original stuck, the new one was ignored). When
      // they match, this was the first write for the (client, date).
      const duplicate =
        me.guess_count !== result.guessCount ||
        Boolean(me.won) !== result.won;

      return { percentile, aggregate, duplicate };
    },

    async aggregate(puzzleDate: string) {
      const rows = await d1Query<DailyResultRow>(
        config,
        `SELECT client_id, guess_count, won
           FROM daily_results
           WHERE puzzle_date = ?`,
        [puzzleDate],
      );
      return aggregateRows(rows);
    },
  };
}

/** Reads CF_* env vars and returns a config if all are present, or null
 *  if any is missing. Used by getDailyStore() to decide between the
 *  D1 adapter and the in-memory fallback. */
export function readD1ConfigFromEnv(): D1Config | null {
  const accountId = process.env.CF_ACCOUNT_ID;
  const databaseId = process.env.CF_D1_DATABASE_ID;
  const apiToken = process.env.CF_D1_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}
