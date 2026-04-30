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
  /** Redraws burned on this pending pair before the player picked.
   *  Round-trips so a refresh mid-pending preserves the deck offset. */
  redraws: z.number().int().min(0).optional(),
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
// v2 split played / wins / distribution per digit count so the stats
// view can filter by 5 / 6 / All. v3 also splits streaks per bucket
// (in addition to a global streak) so the toggle drives streak/best
// too. v1 stats (predates the 6-digit variant) bucket entirely into
// "5" on migration; v2 stats keep their existing global streak and
// initialize per-bucket streaks to 0 (we don't have history to
// reconstruct them).

const perDigitStatsSchema = z.object({
  played: z.number(),
  wins: z.number(),
  /** guess-count histogram for wins. Keys are stringified guess counts. */
  distribution: z.record(z.string(), z.number()),
  /** Streak across this digit-count's games only. */
  currentStreak: z.number(),
  bestStreak: z.number(),
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
    "5": z.object({
      played: z.number(),
      wins: z.number(),
      distribution: z.record(z.string(), z.number()),
    }),
    "6": z.object({
      played: z.number(),
      wins: z.number(),
      distribution: z.record(z.string(), z.number()),
    }),
  }),
});

const personalStatsV3Schema = z.object({
  version: z.literal(3),
  currentStreak: z.number(),
  bestStreak: z.number(),
  byDigits: z.object({
    "5": perDigitStatsSchema,
    "6": perDigitStatsSchema,
  }),
});

export type PerDigitStats = z.infer<typeof perDigitStatsSchema>;
export type PersonalStats = z.infer<typeof personalStatsV3Schema>;

const STATS_KEY_UNLIMITED = "stats:unlimited";

function emptyPerDigit(): PerDigitStats {
  return {
    played: 0,
    wins: 0,
    distribution: {},
    currentStreak: 0,
    bestStreak: 0,
  };
}

function emptyStats(): PersonalStats {
  return {
    version: 3,
    currentStreak: 0,
    bestStreak: 0,
    byDigits: { "5": emptyPerDigit(), "6": emptyPerDigit() },
  };
}

/** v1 → v3: predates 6-digit; bucket everything as 5-digit and copy the
 *  global streaks into the 5-digit slot too (those games WERE the
 *  global streak at the time). */
function migrateV1(v1: z.infer<typeof personalStatsV1Schema>): PersonalStats {
  return {
    version: 3,
    currentStreak: v1.currentStreak,
    bestStreak: v1.bestStreak,
    byDigits: {
      "5": {
        played: v1.played,
        wins: v1.wins,
        distribution: v1.distribution,
        currentStreak: v1.currentStreak,
        bestStreak: v1.bestStreak,
      },
      "6": emptyPerDigit(),
    },
  };
}

/** v2 → v3: keep global streaks; per-bucket streaks default to 0
 *  because the v2 schema didn't track them and we can't reconstruct. */
function migrateV2(v2: z.infer<typeof personalStatsV2Schema>): PersonalStats {
  return {
    version: 3,
    currentStreak: v2.currentStreak,
    bestStreak: v2.bestStreak,
    byDigits: {
      "5": { ...v2.byDigits["5"], currentStreak: 0, bestStreak: 0 },
      "6": { ...v2.byDigits["6"], currentStreak: 0, bestStreak: 0 },
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
  // Try v3, then v2, then v1, then give up.
  const asV3 = personalStatsV3Schema.safeParse(parsed);
  if (asV3.success) return asV3.data;
  const asV2 = personalStatsV2Schema.safeParse(parsed);
  if (asV2.success) return migrateV2(asV2.data);
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
    // Global streak: only the just-played bucket affects it (a 5-digit
    // win still extends the overall streak even if it's a different
    // length than the previous one).
    s.currentStreak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    // Per-bucket streak: only the matching bucket extends — playing 6
    // doesn't move the 5-digit streak in either direction.
    bucket.currentStreak += 1;
    bucket.bestStreak = Math.max(bucket.bestStreak, bucket.currentStreak);
    bucket.distribution[String(guessCount)] =
      (bucket.distribution[String(guessCount)] ?? 0) + 1;
  } else {
    s.currentStreak = 0;
    bucket.currentStreak = 0;
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
 *  to "All": played / wins / distribution sum naturally; streaks use
 *  the *global* streaks from the parent record (streaks from
 *  separate buckets can't be added — a streak of 3 in 5-digit and a
 *  streak of 2 in 6-digit aren't a combined streak of 5). */
export function combinedUnlimitedStats(s: PersonalStats): PerDigitStats {
  const out: PerDigitStats = {
    ...emptyPerDigit(),
    currentStreak: s.currentStreak,
    bestStreak: s.bestStreak,
  };
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
