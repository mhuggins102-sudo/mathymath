import { ROUND1_CURATED_CLUE_IDS } from "@/lib/game/clueSelector";
import type { Achievement, AchievementCtx } from "./types";

/** Helper: target contains no dice digits (1-6). Dice digits are
 *  1..6 inclusive (matches diceCount clue). */
function targetHasNoDice(target: string): boolean {
  for (const ch of target) {
    const d = Number(ch);
    if (d >= 1 && d <= 6) return false;
  }
  return true;
}

/** Helper: target contains ONLY dice digits (every char is 1..6). */
function targetIsAllDice(target: string): boolean {
  for (const ch of target) {
    const d = Number(ch);
    if (d < 1 || d > 6) return false;
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

/** Count correct-slot matches between a guess and the target. */
function correctDigitCount(guess: string, target: string): number {
  let n = 0;
  const len = Math.min(guess.length, target.length);
  for (let i = 0; i < len; i++) {
    if (guess[i] === target[i]) n++;
  }
  return n;
}

/** Whether ANY guess result satisfies the predicate. */
function anyResult(
  ctx: AchievementCtx,
  predicate: (
    r: NonNullable<AchievementCtx["guesses"][number]["result"]>,
  ) => boolean,
): boolean {
  for (const g of ctx.guesses) {
    if (g.result && predicate(g.result)) return true;
  }
  return false;
}

// --- Speed --------------------------------------------------------

const speedrun: Achievement = {
  id: "speedrun",
  name: "Speedrun",
  description: "Quick unlimited wins.",
  level1: {
    label: "Win an unlimited game in 4 turns or fewer.",
    detect: (c) =>
      c.mode === "unlimited" && c.status === "won" && c.guesses.length <= 4,
  },
  level2: {
    label: "Win an unlimited game in 3 turns or fewer.",
    detect: (c) =>
      c.mode === "unlimited" && c.status === "won" && c.guesses.length <= 3,
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

const hailMary: Achievement = {
  id: "hailMary",
  name: "Hail Mary",
  description: "Win on the final turn after a near-blank previous guess.",
  level1: {
    label:
      "Win on the final turn with at most 1 correct digit on the previous turn.",
    detect: (c) => {
      if (c.status !== "won") return false;
      if (c.guesses.length !== c.maxGuesses) return false;
      const prev = c.guesses[c.guesses.length - 2];
      if (!prev) return false;
      return correctDigitCount(prev.guess, c.target) <= 1;
    },
  },
  level2: {
    label:
      "Win on the final turn with zero correct digits on the previous turn.",
    detect: (c) => {
      if (c.status !== "won") return false;
      if (c.guesses.length !== c.maxGuesses) return false;
      const prev = c.guesses[c.guesses.length - 2];
      if (!prev) return false;
      return correctDigitCount(prev.guess, c.target) === 0;
    },
  },
};

// --- Mastery / streaks --------------------------------------------

const veteran: Achievement = {
  id: "veteran",
  name: "Veteran",
  description: "Total wins across daily and unlimited.",
  level1: {
    label: "Win 25 games total.",
    detect: (c) => c.status === "won" && c.totalWins >= 25,
  },
  level2: {
    label: "Win 100 games total.",
    detect: (c) => c.status === "won" && c.totalWins >= 100,
  },
};

const streaker: Achievement = {
  id: "streaker",
  name: "Streaker",
  description: "Win the daily on consecutive days.",
  level1: {
    label: "Win the daily 7 days in a row.",
    detect: (c) =>
      c.mode === "daily" &&
      c.status === "won" &&
      c.dailyStreakEndingToday >= 7,
  },
  level2: {
    label: "Win the daily 30 days in a row.",
    detect: (c) =>
      c.mode === "daily" &&
      c.status === "won" &&
      c.dailyStreakEndingToday >= 30,
  },
};

const hotHand: Achievement = {
  id: "hotHand",
  name: "Hot Hand",
  description: "Long unlimited win streaks at 5 digits.",
  level1: {
    // "5-digit unlimited" without difficulty / clue-mode constraint —
    // accept the max streak across all four 5-digit buckets.
    label: "Win 10 in a row in 5-digit unlimited.",
    detect: (c) => {
      if (c.mode !== "unlimited" || c.status !== "won") return false;
      const b5 = c.unlimitedStreakByBucket["5"];
      return (
        b5.normal.manual >= 10 ||
        b5.normal.auto >= 10 ||
        b5.hard.manual >= 10 ||
        b5.hard.auto >= 10
      );
    },
  },
  level2: {
    // Mirrors Endurance Gold: specifically the Hard Auto bucket.
    label: "Win 10 in a row in 5-digit Hard Auto unlimited.",
    detect: (c) => {
      if (c.mode !== "unlimited" || c.status !== "won") return false;
      return c.unlimitedStreakByBucket["5"].hard.auto >= 10;
    },
  },
};

const endurance: Achievement = {
  id: "endurance",
  name: "Endurance",
  description: "Long unlimited win streaks at 6 digits.",
  level1: {
    label: "Win 10 in a row in 6-digit unlimited.",
    detect: (c) => {
      if (c.mode !== "unlimited" || c.status !== "won") return false;
      const b6 = c.unlimitedStreakByBucket["6"];
      return (
        b6.normal.manual >= 10 ||
        b6.normal.auto >= 10 ||
        b6.hard.manual >= 10 ||
        b6.hard.auto >= 10
      );
    },
  },
  level2: {
    label: "Win 10 in a row in 6-digit Hard Auto unlimited.",
    detect: (c) => {
      if (c.mode !== "unlimited" || c.status !== "won") return false;
      return c.unlimitedStreakByBucket["6"].hard.auto >= 10;
    },
  },
};

// --- Resource craft -----------------------------------------------

const lockedIn: Achievement = {
  id: "lockedIn",
  name: "Locked In",
  description: "Finish with locks still in the bank.",
  level1: {
    label: "Win with at least 2 locks remaining.",
    detect: (c) => c.status === "won" && c.locksRemaining >= 2,
  },
  level2: {
    label: "Win with at least 3 locks remaining.",
    detect: (c) => c.status === "won" && c.locksRemaining >= 3,
  },
};

const locksmith: Achievement = {
  id: "locksmith",
  name: "Locksmith",
  description: "Successfully lock digits during a winning game.",
  level1: {
    label: "Win with 2 correctly-locked digits in one game.",
    detect: (c) => c.status === "won" && correctLockCount(c) >= 2,
  },
  level2: {
    label: "Win with 3 correctly-locked digits in one game.",
    detect: (c) => c.status === "won" && correctLockCount(c) >= 3,
  },
};

const luckyStart: Achievement = {
  id: "luckyStart",
  name: "Lucky Start",
  description: "Big bullseye payoff on the very first turn.",
  level1: {
    label: "Win with 2+ correct digits on turn 1 (locked or not).",
    detect: (c) => {
      if (c.status !== "won") return false;
      const first = c.guesses[0];
      if (!first) return false;
      return correctDigitCount(first.guess, c.target) >= 2;
    },
  },
  level2: {
    label: "Win with 3+ correct digits on turn 1 (locked or not).",
    detect: (c) => {
      if (c.status !== "won") return false;
      const first = c.guesses[0];
      if (!first) return false;
      return correctDigitCount(first.guess, c.target) >= 3;
    },
  },
};

// --- Clue craft / specifics ---------------------------------------

const mercuryRising: Achievement = {
  id: "mercuryRising",
  name: "Mercury Rising",
  description: "Extreme thermometer readings early in a winning game.",
  criteria: [
    {
      id: "allRed",
      name: "All-red Thermometer on turn 1 or 2",
      detect: (c) => {
        if (c.status !== "won") return false;
        return c.guesses
          .slice(0, 2)
          .some(
            (g) =>
              g.result?.kind === "thermometer" &&
              g.result.tier.length > 0 &&
              g.result.tier.every((t) => t === 2),
          );
      },
    },
    {
      id: "allBlue",
      name: "All-blue Thermometer on turn 1 or 2",
      detect: (c) => {
        if (c.status !== "won") return false;
        return c.guesses
          .slice(0, 2)
          .some(
            (g) =>
              g.result?.kind === "thermometer" &&
              g.result.tier.length > 0 &&
              g.result.tier.every((t) => t === 0),
          );
      },
    },
  ],
};

const sweeper: Achievement = {
  id: "sweeper",
  name: "Sweeper",
  description: "Use Elimination to rule out almost the whole guess.",
  level1: {
    // All but one slot absent. For a 5-digit game that's 4 absent
    // slots; for 6-digit it's 5. Detector compares against the
    // result's mask length so it scales with digits naturally.
    label:
      "Win with an Elimination result that marks all but one slot absent.",
    detect: (c) => {
      if (c.status !== "won") return false;
      return anyResult(
        c,
        (r) =>
          r.kind === "elimination" &&
          r.mask.length > 0 &&
          r.mask.filter(Boolean).length === r.mask.length - 1,
      );
    },
  },
  level2: {
    label:
      "Win with an Elimination result that marks every slot absent.",
    detect: (c) => {
      if (c.status !== "won") return false;
      return anyResult(
        c,
        (r) =>
          r.kind === "elimination" &&
          r.mask.length > 0 &&
          r.mask.every(Boolean),
      );
    },
  },
};

const wideMiss: Achievement = {
  id: "wideMiss",
  name: "Wide Miss",
  description:
    "Be very far off on Digit Sum in 5-digit manual clue mode, then still pull out the win.",
  level1: {
    label:
      "Win a 5-digit manual-clue game after a Digit Sum result off by 20 or more.",
    detect: (c) =>
      c.status === "won" &&
      c.digits === 5 &&
      !c.preselectedMode &&
      anyResult(c, (r) => r.kind === "sumDelta" && Math.abs(r.delta) >= 20),
  },
  level2: {
    label:
      "Win a 5-digit manual-clue game after a Digit Sum result off by 25 or more.",
    detect: (c) =>
      c.status === "won" &&
      c.digits === 5 &&
      !c.preselectedMode &&
      anyResult(c, (r) => r.kind === "sumDelta" && Math.abs(r.delta) >= 25),
  },
};

const trendingUp: Achievement = {
  id: "trendingUp",
  name: "Trending Up",
  description: "Big jumps in Bullseye Trend during a 5-digit winning game.",
  level1: {
    label: "Win a 5-digit game after a Bullseye Trend result of +2 or more.",
    detect: (c) =>
      c.status === "won" &&
      c.digits === 5 &&
      anyResult(c, (r) => r.kind === "bullseyeTrend" && r.delta >= 2),
  },
  level2: {
    label: "Win a 5-digit game after a Bullseye Trend result of +3 or more.",
    detect: (c) =>
      c.status === "won" &&
      c.digits === 5 &&
      anyResult(c, (r) => r.kind === "bullseyeTrend" && r.delta >= 3),
  },
};

const coldOpen: Achievement = {
  id: "coldOpen",
  name: "Cold Open",
  description: "Win without leaning on any starred (turn-1) curated clue.",
  level1: {
    label: "Win a 5-digit game without using any starred clue.",
    detect: (c) => {
      if (c.status !== "won" || c.digits !== 5) return false;
      for (const g of c.guesses) {
        if (g.clueId && ROUND1_CURATED_CLUE_IDS.has(g.clueId)) return false;
      }
      return true;
    },
  },
  level2: {
    label: "Win a 6-digit game without using any starred clue.",
    detect: (c) => {
      if (c.status !== "won" || c.digits !== 6) return false;
      for (const g of c.guesses) {
        if (g.clueId && ROUND1_CURATED_CLUE_IDS.has(g.clueId)) return false;
      }
      return true;
    },
  },
};

// --- Situational --------------------------------------------------

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

const diceDiceBaby: Achievement = {
  id: "diceDiceBaby",
  name: "Dice, Dice Baby",
  description: "Win against an all-dice or no-dice target.",
  criteria: [
    {
      id: "allDice",
      name: "Win when the target contains only dice digits (1-6)",
      detect: (c) => c.status === "won" && targetIsAllDice(c.target),
    },
    {
      id: "noDice",
      name: "Win when the target contains no dice digits (0/7/8/9)",
      detect: (c) => c.status === "won" && targetHasNoDice(c.target),
    },
  ],
};

const eleventhHour: Achievement = {
  id: "eleventhHour",
  name: "Eleventh Hour",
  description:
    "Let Oracle save the round at the last possible moment.",
  criteria: [
    {
      id: "fiveDigit",
      name:
        "Win a 5-digit game when Oracle reveals the only remaining unknown slot",
      detect: (c) => eleventhHourDetect(c) && c.digits === 5,
    },
    {
      id: "sixDigit",
      name:
        "Win a 6-digit game when Oracle reveals the only remaining unknown slot",
      detect: (c) => eleventhHourDetect(c) && c.digits === 6,
    },
  ],
};

function eleventhHourDetect(c: AchievementCtx): boolean {
  if (c.status !== "won") return false;
  const last = c.guesses[c.guesses.length - 1];
  if (!last || last.result?.kind !== "oracle") return false;
  const oracleSlot = last.result.slot;
  // Player's typed guess matches target everywhere EXCEPT the oracle
  // slot — meaning Oracle's reveal completed the target.
  for (let i = 0; i < c.target.length; i++) {
    if (i === oracleSlot) continue;
    if (last.guess[i] !== c.target[i]) return false;
  }
  return true;
}

/** Display order in the achievements modal. Logical groups, top-down:
 *    1. Speed
 *    2. Mastery / streaks
 *    3. Resource craft
 *    4. Clue craft / specifics
 *    5. Situational
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  // Speed
  speedrun,
  dailySprint,
  ironPlayer,
  hailMary,
  // Mastery / streaks
  veteran,
  streaker,
  hotHand,
  endurance,
  // Resource craft
  lockedIn,
  locksmith,
  luckyStart,
  // Clue craft / specifics
  mercuryRising,
  sweeper,
  wideMiss,
  trendingUp,
  coldOpen,
  // Situational
  luckyTarget,
  diceDiceBaby,
  eleventhHour,
];

/** Total number of distinct unlock slots (sum of levels across all
 *  achievements). Used for the modal's "X / N unlocked" header.
 *  Criteria-style achievements still have two unlock slots (silver
 *  for any criterion, gold for all criteria). */
export const TOTAL_UNLOCK_SLOTS = ACHIEVEMENTS.reduce(
  (n, a) => n + (a.criteria ? 2 : a.level2 ? 2 : 1),
  0,
);
