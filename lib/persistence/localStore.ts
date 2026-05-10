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
// Unlimited mode: 5-digit or 6-digit. The choice is saved so reloads
// keep the preferred shape. Daily is unaffected — it's always 5-digit.
// Older saves may carry a retired "mix" value; loadUnlimitedMode falls
// back to "5" for any unrecognized stored value.

export type UnlimitedMode = "5" | "6";

const UNLIMITED_MODE_KEY = "unlimitedMode";

const unlimitedModeSchema = z.enum(["5", "6"]);

export function loadUnlimitedMode(): UnlimitedMode {
  if (typeof window === "undefined") return "5";
  const raw = window.localStorage.getItem(STORAGE_PREFIX + UNLIMITED_MODE_KEY);
  if (!raw) return "5";
  const parsed = unlimitedModeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "5";
}

// Has-seen-tutorial flag drives the first-run Help auto-open on the
// home screen. Set the very first time the home page loads (after the
// auto-open fires) so subsequent visits don't pop the modal again.

const TUTORIAL_SEEN_KEY = "tutorialSeen";

export function hasSeenTutorial(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_PREFIX + TUTORIAL_SEEN_KEY) === "1";
}

export function markTutorialSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + TUTORIAL_SEEN_KEY, "1");
  } catch {
    // ignore quota errors
  }
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

/** v4 splits each per-digit bucket into Normal vs Hard so the stats UI
 *  can filter on difficulty. v3 data migrates everything into the
 *  `normal` slot — Hard mode existed before v4 but wasn't tracked
 *  separately, so we lose that distinction for legacy plays. New
 *  plays after the migration are tagged correctly. */
const perDigitByModeSchema = z.object({
  normal: perDigitStatsSchema,
  hard: perDigitStatsSchema,
});

const personalStatsV4Schema = z.object({
  version: z.literal(4),
  currentStreak: z.number(),
  bestStreak: z.number(),
  byDigits: z.object({
    "5": perDigitByModeSchema,
    "6": perDigitByModeSchema,
  }),
});

export type PerDigitStats = z.infer<typeof perDigitStatsSchema>;
export type PerDigitByMode = z.infer<typeof perDigitByModeSchema>;
export type PersonalStats = z.infer<typeof personalStatsV4Schema>;
export type StatsDifficulty = "normal" | "hard";

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

function emptyPerDigitByMode(): PerDigitByMode {
  return { normal: emptyPerDigit(), hard: emptyPerDigit() };
}

function emptyStats(): PersonalStats {
  return {
    version: 4,
    currentStreak: 0,
    bestStreak: 0,
    byDigits: {
      "5": emptyPerDigitByMode(),
      "6": emptyPerDigitByMode(),
    },
  };
}

/** v1 → v4: predates 6-digit AND difficulty split; bucket everything
 *  into the 5-digit Normal slot, copy global streaks. */
function migrateV1(v1: z.infer<typeof personalStatsV1Schema>): PersonalStats {
  const slot: PerDigitStats = {
    played: v1.played,
    wins: v1.wins,
    distribution: v1.distribution,
    currentStreak: v1.currentStreak,
    bestStreak: v1.bestStreak,
  };
  return {
    version: 4,
    currentStreak: v1.currentStreak,
    bestStreak: v1.bestStreak,
    byDigits: {
      "5": { normal: slot, hard: emptyPerDigit() },
      "6": emptyPerDigitByMode(),
    },
  };
}

/** v2 → v4: keep global streaks; per-bucket streaks default to 0;
 *  legacy plays land in Normal (Hard wasn't separately tracked). */
function migrateV2(v2: z.infer<typeof personalStatsV2Schema>): PersonalStats {
  return {
    version: 4,
    currentStreak: v2.currentStreak,
    bestStreak: v2.bestStreak,
    byDigits: {
      "5": {
        normal: { ...v2.byDigits["5"], currentStreak: 0, bestStreak: 0 },
        hard: emptyPerDigit(),
      },
      "6": {
        normal: { ...v2.byDigits["6"], currentStreak: 0, bestStreak: 0 },
        hard: emptyPerDigit(),
      },
    },
  };
}

/** v3 → v4: keep streaks; legacy per-digit stats land in Normal. Old
 *  Hard-mode plays counted in v3's per-digit bucket are not separable
 *  retroactively, so they stay merged into Normal — acceptable since
 *  Hard is a small minority of plays in practice. */
function migrateV3(v3: z.infer<typeof personalStatsV3Schema>): PersonalStats {
  return {
    version: 4,
    currentStreak: v3.currentStreak,
    bestStreak: v3.bestStreak,
    byDigits: {
      "5": { normal: v3.byDigits["5"], hard: emptyPerDigit() },
      "6": { normal: v3.byDigits["6"], hard: emptyPerDigit() },
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
  // Try v4, then v3, v2, v1, then give up.
  const asV4 = personalStatsV4Schema.safeParse(parsed);
  if (asV4.success) return asV4.data;
  const asV3 = personalStatsV3Schema.safeParse(parsed);
  if (asV3.success) return migrateV3(asV3.data);
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
  difficulty: StatsDifficulty,
): PersonalStats {
  const s = loadUnlimitedStats();
  // Bucket by (digits, difficulty). Anything outside the 5/6 keys we
  // know about gets coerced to "5" so legacy callers don't silently
  // drop data.
  const dKey: "5" | "6" = digits === 6 ? "6" : "5";
  const bucket = s.byDigits[dKey][difficulty];
  bucket.played += 1;
  if (won) {
    bucket.wins += 1;
    // Global streak: any win extends the overall streak — players
    // playing across digits/modes still get one cohesive streak number.
    s.currentStreak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    // Per-bucket streak: only the exact (digits, mode) bucket extends.
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

/** Combined view across selected digit and difficulty buckets. `digit`
 *  / `difficulty` each accept "all" to combine both sides of that
 *  axis. Streaks come from the global record when ANY axis is "all"
 *  (cross-bucket streaks can't be summed). When both axes pin a single
 *  bucket the per-bucket streaks pass through. */
export function sliceUnlimitedStats(
  s: PersonalStats,
  opts: {
    digit?: "all" | "5" | "6";
    difficulty?: "all" | StatsDifficulty;
  } = {},
): PerDigitStats {
  const digitOpt = opts.digit ?? "all";
  const diffOpt = opts.difficulty ?? "all";
  const digitKeys: ("5" | "6")[] = digitOpt === "all" ? ["5", "6"] : [digitOpt];
  const diffKeys: StatsDifficulty[] =
    diffOpt === "all" ? ["normal", "hard"] : [diffOpt];

  // Single-bucket pass-through preserves the bucket's own streaks.
  if (digitKeys.length === 1 && diffKeys.length === 1) {
    return { ...s.byDigits[digitKeys[0]][diffKeys[0]] };
  }

  const out: PerDigitStats = {
    ...emptyPerDigit(),
    currentStreak: s.currentStreak,
    bestStreak: s.bestStreak,
  };
  for (const d of digitKeys) {
    for (const m of diffKeys) {
      const b = s.byDigits[d][m];
      out.played += b.played;
      out.wins += b.wins;
      for (const [k, v] of Object.entries(b.distribution)) {
        out.distribution[k] = (out.distribution[k] ?? 0) + v;
      }
    }
  }
  return out;
}

/** Backward-compat shim: combined view across both digit buckets in
 *  Normal AND Hard. Equivalent to sliceUnlimitedStats(s, {}). */
export function combinedUnlimitedStats(s: PersonalStats): PerDigitStats {
  return sliceUnlimitedStats(s);
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

// --- Daily percentile cache ---
//
// The /api/results POST returns the player's percentile + the global
// distribution. Caching that response per puzzle date keeps the result
// panel snappy on revisit (no loading flash) and — more importantly —
// gives us a fallback when a re-submit fails, e.g. for puzzles whose
// localStorage save predates the redraws-persistence fix and so can't
// be replayed by the server. The cache is overwritten every time the
// server returns a fresh response, so leaderboard freshness still
// catches up as the puzzle ages.

const dailyPercentileCacheSchema = z.object({
  version: z.literal(1),
  percentile: z.number(),
  aggregate: z.object({
    total: z.number(),
    wins: z.number(),
    distribution: z.record(z.string(), z.number()),
  }),
  cachedAt: z.number(),
});

export type DailyPercentileCache = z.infer<typeof dailyPercentileCacheSchema>;

const DAILY_PERCENTILE_PREFIX = "dailyPercentile:";

export function saveDailyPercentile(
  date: string,
  value: { percentile: number; aggregate: DailyPercentileCache["aggregate"] },
): void {
  if (typeof window === "undefined") return;
  const payload: DailyPercentileCache = {
    version: 1,
    percentile: value.percentile,
    aggregate: value.aggregate,
    cachedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + DAILY_PERCENTILE_PREFIX + date,
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota errors
  }
}

export function loadDailyPercentile(
  date: string,
): DailyPercentileCache | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(
    STORAGE_PREFIX + DAILY_PERCENTILE_PREFIX + date,
  );
  if (!raw) return null;
  try {
    return dailyPercentileCacheSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
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
