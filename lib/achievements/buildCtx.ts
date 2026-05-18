"use client";

import { initialLocksFor, locksAvailable } from "@/lib/game/locks";
import {
  combinedUnlimitedStats,
  dailyHistoryStats,
  loadDailyHistory,
  loadUnlimitedStats,
} from "@/lib/persistence/localStore";
import type {
  AchievementCtx,
  ResolvedGuessLite,
} from "./types";

interface BuildCtxArgs {
  mode: "daily" | "unlimited";
  digits: number;
  status: "won" | "lost";
  target: string;
  guesses: readonly ResolvedGuessLite[];
  advancedMode: boolean;
  preselectedMode: boolean;
  maxGuesses: number;
}

/** Assemble an AchievementCtx from the just-finished game. Reads
 *  aggregate stats AFTER the round's recordResult calls have run, so
 *  totals reflect the current game. Daily streak comes from the daily
 *  history (already updated by `recordDailyResult`); unlimited streaks
 *  come from the difficulty-split PersonalStats buckets. */
export function buildAchievementCtx(args: BuildCtxArgs): AchievementCtx {
  const unlimited = loadUnlimitedStats();
  const daily = dailyHistoryStats(loadDailyHistory());
  const combinedUnlimited = combinedUnlimitedStats(unlimited);
  const totalWins = combinedUnlimited.wins + daily.wins;

  const initialLocks = initialLocksFor(args.advancedMode);
  const locksRemaining = locksAvailable(args.guesses, initialLocks);

  let redrawsUsed = 0;
  for (const g of args.guesses) redrawsUsed += g.redraws ?? 0;

  return {
    mode: args.mode,
    digits: args.digits,
    status: args.status,
    target: args.target,
    guesses: args.guesses,
    advancedMode: args.advancedMode,
    preselectedMode: args.preselectedMode,
    maxGuesses: args.maxGuesses,
    totalWins,
    locksRemaining,
    redrawsUsed,
    dailyStreakEndingToday: daily.currentStreak,
    unlimitedStreakByBucket: {
      "5": {
        normal: {
          manual: unlimited.byDigits["5"].normal.manual.currentStreak,
          auto: unlimited.byDigits["5"].normal.auto.currentStreak,
        },
        hard: {
          manual: unlimited.byDigits["5"].hard.manual.currentStreak,
          auto: unlimited.byDigits["5"].hard.auto.currentStreak,
        },
      },
      "6": {
        normal: {
          manual: unlimited.byDigits["6"].normal.manual.currentStreak,
          auto: unlimited.byDigits["6"].normal.auto.currentStreak,
        },
        hard: {
          manual: unlimited.byDigits["6"].hard.manual.currentStreak,
          auto: unlimited.byDigits["6"].hard.auto.currentStreak,
        },
      },
    },
  };
}
