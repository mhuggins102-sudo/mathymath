/**
 * In-memory daily results aggregator. Used in development and tests; in
 * production, getDailyStore() swaps in the Cloudflare D1 adapter when
 * CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_D1_API_TOKEN are all set.
 *
 * The in-memory store is module-scoped, so a single Next.js server
 * process tracks submissions until restart. It is NOT shared across
 * serverless instances — that's the D1 adapter's job.
 *
 * D1 schema is in `scripts/d1-schema.sql`.
 */

import {
  createD1DailyStore,
  readD1ConfigFromEnv,
} from "./dailyStoreD1";

export interface DailyResult {
  clientId: string;
  puzzleDate: string; // YYYY-MM-DD
  guessCount: number;
  won: boolean;
  chosenClues: { guessIdx: number; clueId: string }[];
  durationMs?: number;
  createdAt: number;
}

export interface DailyAggregate {
  total: number;
  wins: number;
  /** guessCount -> number of wins */
  distribution: Record<number, number>;
}

export interface DailyStore {
  submit(result: DailyResult): Promise<{ percentile: number; aggregate: DailyAggregate; duplicate: boolean }>;
  aggregate(puzzleDate: string): Promise<DailyAggregate>;
}

type Key = string; // `${clientId}|${puzzleDate}`

const resultsByDate = new Map<string, DailyResult[]>();
const seen = new Set<Key>();

function ensureDate(date: string): DailyResult[] {
  let arr = resultsByDate.get(date);
  if (!arr) {
    arr = [];
    resultsByDate.set(date, arr);
  }
  return arr;
}

function computeAggregate(arr: DailyResult[]): DailyAggregate {
  const agg: DailyAggregate = { total: arr.length, wins: 0, distribution: {} };
  for (const r of arr) {
    if (r.won) {
      agg.wins++;
      agg.distribution[r.guessCount] = (agg.distribution[r.guessCount] ?? 0) + 1;
    }
  }
  return agg;
}

function percentileOf(arr: DailyResult[], me: DailyResult): number {
  // % of players whose score is STRICTLY WORSE than me.
  // Losses count as worse than any win. Among wins, more guesses = worse.
  const score = (r: DailyResult) => (r.won ? r.guessCount : 999);
  const myScore = score(me);
  let beaten = 0;
  for (const r of arr) {
    if (r === me) continue;
    if (score(r) > myScore) beaten++;
  }
  const denom = Math.max(1, arr.length - 1);
  return Math.round((beaten / denom) * 100);
}

export const inMemoryDailyStore: DailyStore = {
  async submit(result) {
    const key = `${result.clientId}|${result.puzzleDate}`;
    const arr = ensureDate(result.puzzleDate);
    const duplicate = seen.has(key);
    if (!duplicate) {
      seen.add(key);
      arr.push(result);
    }
    const stored = duplicate
      ? arr.find((r) => r.clientId === result.clientId) ?? result
      : result;
    const aggregate = computeAggregate(arr);
    const percentile = percentileOf(arr, stored);
    return { percentile, aggregate, duplicate };
  },
  async aggregate(puzzleDate) {
    return computeAggregate(resultsByDate.get(puzzleDate) ?? []);
  },
};

/** Cached store instance. Selected once on first access so we don't
 *  re-read env vars (or re-construct an HTTP client) on every request. */
let cachedStore: DailyStore | null = null;

export function getDailyStore(): DailyStore {
  if (cachedStore) return cachedStore;
  const cfg = readD1ConfigFromEnv();
  cachedStore = cfg ? createD1DailyStore(cfg) : inMemoryDailyStore;
  return cachedStore;
}

/** Test-only escape hatch: drop the cached store so the next call to
 *  getDailyStore re-reads env. Not exported from the package barrel. */
export function _resetDailyStoreCacheForTests(): void {
  cachedStore = null;
}
