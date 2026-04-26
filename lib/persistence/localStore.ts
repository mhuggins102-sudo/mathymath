"use client";

import { z } from "zod";
import type { GameState } from "@/lib/game/stateMachine";
import type { ClueResult } from "@/lib/game/clues/types";

const STORAGE_PREFIX = "mathymath:";

const guessSchema = z.object({
  guess: z.string(),
  clueId: z.string().optional(),
  result: z.unknown().optional(),
});

const savedGameSchema = z.object({
  version: z.literal(1),
  target: z.string(),
  digits: z.number(),
  maxGuesses: z.number(),
  seed: z.string(),
  status: z.enum(["playing", "won", "lost"]),
  guesses: z.array(guessSchema),
});

export type SavedGame = z.infer<typeof savedGameSchema>;

export function saveGame(key: string, state: GameState): void {
  if (typeof window === "undefined") return;
  const payload: SavedGame = {
    version: 1,
    target: state.target,
    digits: state.digits,
    maxGuesses: state.maxGuesses,
    seed: state.seed,
    status: state.status,
    guesses: state.guesses,
  };
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota errors
  }
}

export function loadGame(key: string): SavedGame | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
  if (!raw) return null;
  try {
    return savedGameSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearGame(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_PREFIX + key);
}

// --- Daily mode persistence ---
//
// Daily games are server-mediated: the target never crosses the wire
// during play, so the client-persisted shape does NOT include it. The
// revealed target is only stored once the game ends (the server returns
// it on win/loss so the "target was XXXXX" UI can render across reloads).

const savedLockSchema = z.object({
  slot: z.number().int().min(0).max(9),
  digit: z.string().regex(/^[0-9]$/),
  correct: z.boolean(),
});

const savedDailyGuessSchema = z.object({
  guess: z.string(),
  clueId: z.string().optional(),
  result: z.unknown().optional(),
  locks: z.array(savedLockSchema).optional(),
  redraws: z.number().int().min(0).optional(),
});

const savedDailyPendingSchema = z.object({
  guess: z.string(),
  optionIds: z.tuple([z.string(), z.string()]),
  /** Locks already resolved for correctness by the server on submit.
   *  Stashed here so that CHOOSE_CLUE can merge them into the next
   *  resolved guess, and so a refresh mid-pending preserves them. */
  locks: z.array(savedLockSchema).optional(),
});

const savedDailyGameSchema = z.object({
  version: z.literal(1),
  date: z.string(),
  digits: z.number(),
  maxGuesses: z.number(),
  guesses: z.array(savedDailyGuessSchema),
  pendingGuess: savedDailyPendingSchema.nullable(),
  status: z.enum(["playing", "won", "lost"]),
  revealedTarget: z.string().nullable(),
});

export type SavedDailyGame = z.infer<typeof savedDailyGameSchema>;

export interface SavedDailyGuess {
  guess: string;
  clueId?: string;
  result?: ClueResult;
}

export function saveDailyGame(key: string, value: SavedDailyGame): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify(value),
    );
  } catch {
    // ignore quota errors
  }
}

export function loadDailyGame(key: string): SavedDailyGame | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
  if (!raw) return null;
  try {
    return savedDailyGameSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

// --- Unlimited mode preference ---
//
// The Unlimited page lets the player choose 5-digit, 6-digit, or "mix"
// (weighted 3:1 between 5 and 6). The choice is saved so reloads keep
// the preferred shape. Daily is unaffected — it's always 5-digit.

export type UnlimitedMode = "5" | "6" | "mix";

const UNLIMITED_MODE_KEY = "unlimitedMode";

const unlimitedModeSchema = z.enum(["5", "6", "mix"]);

export function loadUnlimitedMode(): UnlimitedMode {
  if (typeof window === "undefined") return "5";
  const raw = window.localStorage.getItem(STORAGE_PREFIX + UNLIMITED_MODE_KEY);
  if (!raw) return "5";
  const parsed = unlimitedModeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "5";
}

export function saveUnlimitedMode(mode: UnlimitedMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + UNLIMITED_MODE_KEY, mode);
  } catch {
    // ignore quota errors
  }
}

// --- Personal stats (unlimited mode) ---
//
// v2 splits played / wins / distribution per digit count so the stats
// view can filter by 5-digit, 6-digit, or All. Streaks remain global
// because a streak crossing puzzle lengths still feels like a streak.
// v1 stats (predates the 6-digit variant) are migrated as 5-digit.

const perDigitStatsSchema = z.object({
  played: z.number(),
  wins: z.number(),
  /** guess-count histogram for wins. Keys are stringified guess counts. */
  distribution: z.record(z.string(), z.number()),
});

const personalStatsV1Schema = z.object({
  version: z.literal(1),
  played: z.number(),
  wins: z.number(),
  currentStreak: z.number(),
  bestStreak: z.number(),
  distribution: z.record(z.string(), z.number()),
});

const personalStatsV2Schema = z.object({
  version: z.literal(2),
  currentStreak: z.number(),
  bestStreak: z.number(),
  byDigits: z.object({
    "5": perDigitStatsSchema,
    "6": perDigitStatsSchema,
  }),
});

export type PerDigitStats = z.infer<typeof perDigitStatsSchema>;
export type PersonalStats = z.infer<typeof personalStatsV2Schema>;

const STATS_KEY_UNLIMITED = "stats:unlimited";

function emptyPerDigit(): PerDigitStats {
  return { played: 0, wins: 0, distribution: {} };
}

function emptyStats(): PersonalStats {
  return {
    version: 2,
    currentStreak: 0,
    bestStreak: 0,
    byDigits: { "5": emptyPerDigit(), "6": emptyPerDigit() },
  };
}

/** v1 → v2: any games on record predate the 6-digit variant, so they
 *  bucket entirely into "5". */
function migrateV1(v1: z.infer<typeof personalStatsV1Schema>): PersonalStats {
  return {
    version: 2,
    currentStreak: v1.currentStreak,
    bestStreak: v1.bestStreak,
    byDigits: {
      "5": {
        played: v1.played,
        wins: v1.wins,
        distribution: v1.distribution,
      },
      "6": emptyPerDigit(),
    },
  };
}

export function loadUnlimitedStats(): PersonalStats {
  if (typeof window === "undefined") return emptyStats();
  const raw = window.localStorage.getItem(STORAGE_PREFIX + STATS_KEY_UNLIMITED);
  if (!raw) return emptyStats();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyStats();
  }
  // Try v2 first, then fall back to v1 + migrate.
  const asV2 = personalStatsV2Schema.safeParse(parsed);
  if (asV2.success) return asV2.data;
  const asV1 = personalStatsV1Schema.safeParse(parsed);
  if (asV1.success) return migrateV1(asV1.data);
  return emptyStats();
}

export function recordUnlimitedResult(
  won: boolean,
  guessCount: number,
  digits: number,
): PersonalStats {
  const s = loadUnlimitedStats();
  // Bucket by digit count. Anything outside the 5/6 keys we know about
  // gets coerced to "5" so legacy callers don't silently drop data.
  const key: "5" | "6" = digits === 6 ? "6" : "5";
  const bucket = s.byDigits[key];
  bucket.played += 1;
  if (won) {
    bucket.wins += 1;
    s.currentStreak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    bucket.distribution[String(guessCount)] =
      (bucket.distribution[String(guessCount)] ?? 0) + 1;
  } else {
    s.currentStreak = 0;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_PREFIX + STATS_KEY_UNLIMITED,
      JSON.stringify(s),
    );
  }
  return s;
}

/** Combined view across digit buckets. Used when the stats UI is set
 *  to "All". */
export function combinedUnlimitedStats(s: PersonalStats): PerDigitStats {
  const out: PerDigitStats = emptyPerDigit();
  for (const key of ["5", "6"] as const) {
    const b = s.byDigits[key];
    out.played += b.played;
    out.wins += b.wins;
    for (const [k, v] of Object.entries(b.distribution)) {
      out.distribution[k] = (out.distribution[k] ?? 0) + v;
    }
  }
  return out;
}

// --- Personal daily history ---
//
// One entry per puzzle date. First submission for a date wins (so replays
// don't skew personal stats). Stored under `mathymath:dailyHistory`.

const dailyHistoryEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guessCount: z.number().int().min(1).max(20),
  won: z.boolean(),
  recordedAt: z.number(),
});

const dailyHistorySchema = z.object({
  version: z.literal(1),
  entries: z.array(dailyHistoryEntrySchema),
});

export type DailyHistoryEntry = z.infer<typeof dailyHistoryEntrySchema>;
export type DailyHistory = z.infer<typeof dailyHistorySchema>;

const DAILY_HISTORY_KEY = "dailyHistory";

export function loadDailyHistory(): DailyHistory {
  if (typeof window === "undefined") return { version: 1, entries: [] };
  const raw = window.localStorage.getItem(STORAGE_PREFIX + DAILY_HISTORY_KEY);
  if (!raw) return { version: 1, entries: [] };
  try {
    return dailyHistorySchema.parse(JSON.parse(raw));
  } catch {
    return { version: 1, entries: [] };
  }
}

/** Upserts (date dedupe: first write wins). Returns updated history. */
export function recordDailyResult(
  date: string,
  guessCount: number,
  won: boolean,
): DailyHistory {
  const h = loadDailyHistory();
  if (h.entries.some((e) => e.date === date)) return h;
  h.entries.push({ date, guessCount, won, recordedAt: Date.now() });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_PREFIX + DAILY_HISTORY_KEY,
      JSON.stringify(h),
    );
  }
  return h;
}

export interface DailyHistoryStats {
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  /** keyed as string to match PersonalStats shape for UI reuse. */
  distribution: Record<string, number>;
}

/** Compute aggregate personal stats from history. */
export function dailyHistoryStats(h: DailyHistory): DailyHistoryStats {
  const stats: DailyHistoryStats = {
    played: h.entries.length,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: {},
  };
  // Sort by date ascending to compute streaks chronologically.
  const sorted = [...h.entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  let streak = 0;
  for (const e of sorted) {
    if (e.won) {
      stats.wins += 1;
      streak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
      const k = String(e.guessCount);
      stats.distribution[k] = (stats.distribution[k] ?? 0) + 1;
    } else {
      streak = 0;
    }
    stats.currentStreak = streak;
  }
  return stats;
}

/** Clear all local mathymath data. Used by settings "reset" action. */
export function clearAllLocalData(): void {
  if (typeof window === "undefined") return;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
  }
  for (const k of toRemove) window.localStorage.removeItem(k);
}
