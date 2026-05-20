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
  /** Per-game guess budget. Used by detectors that need to know
   *  whether a win happened on the very last possible turn. */
  maxGuesses: number;
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
  /** Unlimited current-streak snapshot by (digit, difficulty, clueMode)
   *  bucket, post-recording. Detectors gate long unlimited streaks
   *  on this. Daily mode populates these from PersonalStats too,
   *  though daily-specific achievements should use
   *  `dailyStreakEndingToday`. */
  unlimitedStreakByBucket: {
    "5": {
      normal: { manual: number; auto: number };
      hard: { manual: number; auto: number };
    };
    "6": {
      normal: { manual: number; auto: number };
      hard: { manual: number; auto: number };
    };
  };
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

/** Multi-criteria achievement model: instead of "level 1 → silver,
 *  level 2 → gold", the player earns one prong → silver and both
 *  prongs (any order) → gold. */
export interface AchievementCriterion {
  /** Stable id stored in localStorage so a later registry edit can
   *  add a third criterion without losing earlier timestamps. */
  id: string;
  /** Short display label shown in the modal popup. */
  name: string;
  detect: Detector;
}

export interface Achievement {
  id: string;
  name: string;
  /** One-line shared description shown on the modal card. */
  description: string;
  /** Either the level-style schema (level1/level2) OR the criteria-
   *  style schema (criteria). The check pipeline branches on which
   *  one is present. */
  level1?: AchievementLevel;
  level2?: AchievementLevel;
  /** Criteria-based achievement: silver = any one criterion met,
   *  gold = every criterion met. Order is the display order in the
   *  modal popup. */
  criteria?: readonly AchievementCriterion[];
  /** Hidden until unlocked. In the achievements modal, the player
   *  sees the name but not the description / detection label until
   *  they earn it. The trophy state still reflects locked/silver/
   *  gold normally. */
  mystery?: boolean;
}

export type AchievementLevelTier = 1 | 2;

export interface AchievementUnlock {
  id: string;
  level: AchievementLevelTier;
}
