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

const savedDailyGuessSchema = z.object({
  guess: z.string(),
  clueId: z.string().optional(),
  result: z.unknown().optional(),
});

const savedDailyPendingSchema = z.object({
  guess: z.string(),
  optionIds: z.tuple([z.string(), z.string()]),
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

// --- Personal stats (unlimited mode) ---

const personalStatsSchema = z.object({
  version: z.literal(1),
  played: z.number(),
  wins: z.number(),
  currentStreak: z.number(),
  bestStreak: z.number(),
  /** guess-count histogram for wins: index 0 = unused, 1..maxGuesses. */
  distribution: z.record(z.string(), z.number()),
});

export type PersonalStats = z.infer<typeof personalStatsSchema>;

const STATS_KEY_UNLIMITED = "stats:unlimited";

export function loadUnlimitedStats(): PersonalStats {
  if (typeof window === "undefined") return emptyStats();
  const raw = window.localStorage.getItem(STORAGE_PREFIX + STATS_KEY_UNLIMITED);
  if (!raw) return emptyStats();
  try {
    return personalStatsSchema.parse(JSON.parse(raw));
  } catch {
    return emptyStats();
  }
}

export function recordUnlimitedResult(won: boolean, guessCount: number): PersonalStats {
  const s = loadUnlimitedStats();
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.currentStreak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    s.distribution[String(guessCount)] = (s.distribution[String(guessCount)] ?? 0) + 1;
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

function emptyStats(): PersonalStats {
  return {
    version: 1,
    played: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: {},
  };
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
