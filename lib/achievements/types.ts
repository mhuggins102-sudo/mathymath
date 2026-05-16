import type { ClueId, ClueResult } from "@/lib/game/clues/types";
import type { LockRecord } from "@/lib/game/locks";

/** What a detector sees at game end. Built from the just-resolved game
 *  state plus aggregate stats reads after the round's record-*Result
 *  calls have updated the totals. */
export interface AchievementCtx {
  mode: "daily" | "unlimited";
  digits: number;
  status: "won" | "lost";
  /** Always known here — daily mode reveals the target on terminal. */
  target: string;
  guesses: readonly ResolvedGuessLite[];
  advancedMode: boolean;
  preselectedMode: boolean;
  /** Total wins across BOTH modes (daily + unlimited) as of right now. */
  totalWins: number;
  /** Locks remaining at game end (≥0). */
  locksRemaining: number;
  /** Sum of redraws across the game's resolved guesses. */
  redrawsUsed: number;
  /** Daily-only: consecutive win streak ending today. 0 in unlimited
   *  mode (don't gate daily-specific detectors on this — they should
   *  also check `mode === "daily"`). */
  dailyStreakEndingToday: number;
}

/** The subset of ResolvedGuess that achievement detectors care about.
 *  Pinning the type here keeps the achievements module decoupled from
 *  stateMachine's full ResolvedGuess (which carries fields we don't
 *  consult). */
export interface ResolvedGuessLite {
  guess: string;
  clueId?: ClueId;
  result?: ClueResult;
  locks?: readonly LockRecord[];
  redraws?: number;
}

export type Detector = (ctx: AchievementCtx) => boolean;

export interface AchievementLevel {
  /** One-line label shown in the modal and toast. */
  label: string;
  detect: Detector;
}

export interface Achievement {
  id: string;
  name: string;
  /** One-line shared description shown on the modal card. */
  description: string;
  level1: AchievementLevel;
  /** Omitted for single-level achievements. */
  level2?: AchievementLevel;
}

export type AchievementLevelTier = 1 | 2;

export interface AchievementUnlock {
  id: string;
  level: AchievementLevelTier;
}
