/**
 * In-memory daily results aggregator. This is intentionally a module-scoped
 * Map so that a single Next.js server process can track submissions without
 * requiring a database.
 *
 * For production, swap this for a real DB-backed implementation behind the
 * same interface (see `DailyStore` below). Expected DB shape:
 *
 *   daily_results(client_id UUID, puzzle_date DATE, guess_count SMALLINT,
 *                 won BOOLEAN, chosen_clues JSONB, created_at TIMESTAMPTZ,
 *                 UNIQUE(client_id, puzzle_date))
 */

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

export function getDailyStore(): DailyStore {
  // When DATABASE_URL is set, a real implementation can be wired here.
  // For now we always use in-memory.
  return inMemoryDailyStore;
}
