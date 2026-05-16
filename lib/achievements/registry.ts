import type { Achievement, AchievementCtx } from "./types";

/** Helper: did this Contains-Digit-style multiset of all unique digits
 *  in the target produce a "no dice values" condition? Dice digits are
 *  1..6 inclusive (matches diceCount clue). */
function targetHasNoDice(target: string): boolean {
  for (const ch of target) {
    const d = Number(ch);
    if (d >= 1 && d <= 6) return false;
  }
  return true;
}

function distinctTargetDigits(target: string): number {
  return new Set(target).size;
}

function correctLockCount(ctx: AchievementCtx): number {
  let n = 0;
  for (const g of ctx.guesses) {
    if (!g.locks) continue;
    for (const l of g.locks) if (l.correct) n++;
  }
  return n;
}

/** Whether ANY guess result satisfies the predicate. The cast lets the
 *  predicate type-narrow on `result.kind` cleanly at call sites. */
function anyResult<T>(
  ctx: AchievementCtx,
  predicate: (r: NonNullable<AchievementCtx["guesses"][number]["result"]>) => boolean,
): boolean {
  for (const g of ctx.guesses) {
    if (g.result && predicate(g.result)) return true;
  }
  return false;
}

const speedrun: Achievement = {
  id: "speedrun",
  name: "Speedrun",
  description: "Win in few turns.",
  level1: {
    label: "Win in 4 turns or fewer.",
    detect: (c) => c.status === "won" && c.guesses.length <= 4,
  },
  level2: {
    label: "Win in 3 turns or fewer.",
    detect: (c) => c.status === "won" && c.guesses.length <= 3,
  },
};

const lockedIn: Achievement = {
  id: "lockedIn",
  name: "Locked In",
  description: "Finish with locks still in the bank.",
  level1: {
    label: "Win with at least 1 lock remaining.",
    detect: (c) => c.status === "won" && c.locksRemaining >= 1,
  },
  level2: {
    label: "Win with at least 2 locks remaining.",
    detect: (c) => c.status === "won" && c.locksRemaining >= 2,
  },
};

const dailySprint: Achievement = {
  id: "dailySprint",
  name: "Daily Sprint",
  description: "Quick wins on the daily.",
  level1: {
    label: "Win a daily in 5 turns or fewer.",
    detect: (c) =>
      c.mode === "daily" && c.status === "won" && c.guesses.length <= 5,
  },
  level2: {
    label: "Win a daily in 4 turns or fewer.",
    detect: (c) =>
      c.mode === "daily" && c.status === "won" && c.guesses.length <= 4,
  },
};

const veteran: Achievement = {
  id: "veteran",
  name: "Veteran",
  description: "Total wins across daily and unlimited.",
  level1: {
    label: "Win 25 games total.",
    detect: (c) => c.totalWins >= 25,
  },
  level2: {
    label: "Win 100 games total.",
    detect: (c) => c.totalWins >= 100,
  },
};

const ironPlayer: Achievement = {
  id: "ironPlayer",
  name: "Iron Player",
  description: "Win on the hardest settings (6-digit, Hard, Auto).",
  level1: {
    label: "Win 6-digit Hard Auto in 5 turns or fewer.",
    detect: (c) =>
      c.status === "won" &&
      c.digits === 6 &&
      c.advancedMode &&
      c.preselectedMode &&
      c.guesses.length <= 5,
  },
  level2: {
    label: "Win 6-digit Hard Auto in 4 turns or fewer.",
    detect: (c) =>
      c.status === "won" &&
      c.digits === 6 &&
      c.advancedMode &&
      c.preselectedMode &&
      c.guesses.length <= 4,
  },
};

const eleventhHour: Achievement = {
  id: "eleventhHour",
  name: "Eleventh Hour",
  description: "Let Oracle save the round at the last possible moment.",
  level1: {
    label:
      "Win when Oracle reveals the only remaining unknown slot (your guess matches the target everywhere else).",
    detect: (c) => {
      if (c.status !== "won") return false;
      const last = c.guesses[c.guesses.length - 1];
      if (!last || last.result?.kind !== "oracle") return false;
      const oracleSlot = last.result.slot;
      // Player's typed guess matches target everywhere EXCEPT the
      // oracle slot — meaning Oracle's reveal completed the target.
      for (let i = 0; i < c.target.length; i++) {
        if (i === oracleSlot) continue;
        if (last.guess[i] !== c.target[i]) return false;
      }
      return true;
    },
  },
};

const mercuryRising: Achievement = {
  id: "mercuryRising",
  name: "Mercury Rising",
  description: "Extreme thermometer readings early in the game.",
  level1: {
    label:
      "Get an all-red Thermometer (every slot 4+ off) on turn 1 or 2.",
    detect: (c) =>
      c.guesses
        .slice(0, 2)
        .some(
          (g) =>
            g.result?.kind === "thermometer" &&
            g.result.tier.length > 0 &&
            g.result.tier.every((t) => t === 2),
        ),
  },
  level2: {
    label:
      "Get an all-blue Thermometer (every slot within 1) on turn 1 or 2.",
    detect: (c) =>
      c.guesses
        .slice(0, 2)
        .some(
          (g) =>
            g.result?.kind === "thermometer" &&
            g.result.tier.length > 0 &&
            g.result.tier.every((t) => t === 0),
        ),
  },
};

const sweeper: Achievement = {
  id: "sweeper",
  name: "Sweeper",
  description: "Eliminate lots of digits in one shot.",
  level1: {
    label: "Get an Elimination result with 4 or more absent slots.",
    detect: (c) =>
      anyResult(
        c,
        (r) =>
          r.kind === "elimination" && r.mask.filter(Boolean).length >= 4,
      ),
  },
  level2: {
    label: "Get an Elimination result with 5 or more absent slots.",
    detect: (c) =>
      anyResult(
        c,
        (r) =>
          r.kind === "elimination" && r.mask.filter(Boolean).length >= 5,
      ),
  },
};

const wideMiss: Achievement = {
  id: "wideMiss",
  name: "Wide Miss",
  description: "Be very far off on Digit Sum (wins or losses count).",
  level1: {
    label: "Get a Digit Sum result off by 20 or more.",
    detect: (c) =>
      anyResult(
        c,
        (r) => r.kind === "sumDelta" && Math.abs(r.delta) >= 20,
      ),
  },
  level2: {
    label: "Get a Digit Sum result off by 25 or more.",
    detect: (c) =>
      anyResult(
        c,
        (r) => r.kind === "sumDelta" && Math.abs(r.delta) >= 25,
      ),
  },
};

const luckyTarget: Achievement = {
  id: "luckyTarget",
  name: "Lucky Target",
  description: "Win against a target with very few unique digits.",
  level1: {
    label: "Win when the target uses 3 or fewer unique digit values.",
    detect: (c) => c.status === "won" && distinctTargetDigits(c.target) <= 3,
  },
  level2: {
    label: "Win when the target uses 2 or fewer unique digit values.",
    detect: (c) => c.status === "won" && distinctTargetDigits(c.target) <= 2,
  },
};

const diceFree: Achievement = {
  id: "diceFree",
  name: "Dice-Free",
  description: "Win against a target with no dice digits (1-6).",
  level1: {
    label: "Win when the target contains only 0, 7, 8, and/or 9.",
    detect: (c) => c.status === "won" && targetHasNoDice(c.target),
  },
};

const locksmith: Achievement = {
  id: "locksmith",
  name: "Locksmith",
  description: "Successfully lock digits during a single game.",
  level1: {
    label: "Successfully lock 2 digits in one game.",
    detect: (c) => correctLockCount(c) >= 2,
  },
  level2: {
    label: "Successfully lock 3 digits in one game.",
    detect: (c) => correctLockCount(c) >= 3,
  },
};

const trendingUp: Achievement = {
  id: "trendingUp",
  name: "Trending Up",
  description: "Big jumps in Bullseye Trend.",
  level1: {
    label: "Get a Bullseye Trend result of +2 or more.",
    detect: (c) =>
      anyResult(c, (r) => r.kind === "bullseyeTrend" && r.delta >= 2),
  },
  level2: {
    label: "Get a Bullseye Trend result of +3 or more.",
    detect: (c) =>
      anyResult(c, (r) => r.kind === "bullseyeTrend" && r.delta >= 3),
  },
};

const streaker: Achievement = {
  id: "streaker",
  name: "Streaker",
  description: "Win the daily on consecutive days.",
  level1: {
    label: "Win the daily 7 days in a row.",
    detect: (c) => c.mode === "daily" && c.dailyStreakEndingToday >= 7,
  },
};

/** Display order in the achievements modal. Logical groups, top-down:
 *    1. Speed
 *    2. Mastery / totals
 *    3. Resource craft
 *    4. Clue-craft
 *    5. Situational
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  speedrun,
  dailySprint,
  ironPlayer,
  veteran,
  streaker,
  lockedIn,
  locksmith,
  mercuryRising,
  sweeper,
  wideMiss,
  trendingUp,
  luckyTarget,
  diceFree,
  eleventhHour,
];

/** Total number of distinct unlock slots (sum of levels across all
 *  achievements). Used for the modal's "X / N unlocked" header. */
export const TOTAL_UNLOCK_SLOTS = ACHIEVEMENTS.reduce(
  (n, a) => n + (a.level2 ? 2 : 1),
  0,
);
