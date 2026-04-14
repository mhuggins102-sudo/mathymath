"use client";

import { z } from "zod";
import type { GameState } from "@/lib/game/stateMachine";

const STORAGE_PREFIX = "mathymath:";

const guessSchema = z.object({
  guess: z.string(),
  clueId: z.string(),
  result: z.unknown(),
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
