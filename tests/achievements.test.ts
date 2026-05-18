import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "@/lib/achievements/registry";
import type {
  AchievementCtx,
  ResolvedGuessLite,
} from "@/lib/achievements/types";
import type { ClueResult } from "@/lib/game/clues/types";

function findAch(id: string) {
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) throw new Error(`unknown achievement id: ${id}`);
  return ach;
}

function baseCtx(overrides: Partial<AchievementCtx> = {}): AchievementCtx {
  return {
    mode: "unlimited",
    digits: 5,
    status: "won",
    target: "12345",
    guesses: [],
    advancedMode: false,
    preselectedMode: false,
    maxGuesses: 7,
    totalWins: 0,
    locksRemaining: 0,
    redrawsUsed: 0,
    dailyStreakEndingToday: 0,
    unlimitedStreakByBucket: {
      "5": {
        normal: { manual: 0, auto: 0 },
        hard: { manual: 0, auto: 0 },
      },
      "6": {
        normal: { manual: 0, auto: 0 },
        hard: { manual: 0, auto: 0 },
      },
    },
    ...overrides,
  };
}

function guess(
  g: string,
  result?: ClueResult,
  extras: Partial<ResolvedGuessLite> = {},
): ResolvedGuessLite {
  return { guess: g, result, ...extras };
}

describe("registry shape", () => {
  it("contains 19 themes with unique ids", () => {
    expect(ACHIEVEMENTS.length).toBe(19);
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(19);
  });
  it("has no single-level achievements (every detector must occur in a winning game)", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.level2, `${a.id} must have a level2`).toBeDefined();
    }
  });
});

// --- Speed ---

describe("Speedrun (unlimited-only)", () => {
  const ach = findAch("speedrun");
  it("triggers on unlimited win in ≤4 / ≤3", () => {
    expect(
      ach.level1.detect(
        baseCtx({
          mode: "unlimited",
          status: "won",
          guesses: Array(4).fill(guess("11111")),
        }),
      ),
    ).toBe(true);
    expect(
      ach.level2!.detect(
        baseCtx({
          mode: "unlimited",
          status: "won",
          guesses: Array(3).fill(guess("11111")),
        }),
      ),
    ).toBe(true);
  });
  it("does NOT trigger in daily mode (even on a fast win)", () => {
    const ctx = baseCtx({
      mode: "daily",
      status: "won",
      guesses: Array(3).fill(guess("11111")),
    });
    expect(ach.level1.detect(ctx)).toBe(false);
    expect(ach.level2!.detect(ctx)).toBe(false);
  });
});

describe("Daily Sprint (daily-only)", () => {
  const ach = findAch("dailySprint");
  it("L1/L2 thresholds", () => {
    expect(
      ach.level1.detect(
        baseCtx({
          mode: "daily",
          status: "won",
          guesses: Array(5).fill(guess("1")),
        }),
      ),
    ).toBe(true);
    expect(
      ach.level2!.detect(
        baseCtx({
          mode: "daily",
          status: "won",
          guesses: Array(4).fill(guess("1")),
        }),
      ),
    ).toBe(true);
  });
});

describe("Iron Player", () => {
  const ach = findAch("ironPlayer");
  it("requires 6-digit Hard Auto + win + fast", () => {
    const ok = baseCtx({
      status: "won",
      digits: 6,
      advancedMode: true,
      preselectedMode: true,
      guesses: Array(5).fill(guess("111111")),
      target: "111111",
    });
    expect(ach.level1.detect(ok)).toBe(true);
    expect(ach.level1.detect({ ...ok, advancedMode: false })).toBe(false);
    expect(ach.level1.detect({ ...ok, preselectedMode: false })).toBe(false);
    expect(ach.level1.detect({ ...ok, digits: 5 })).toBe(false);
  });
});

describe("Hail Mary", () => {
  const ach = findAch("hailMary");
  it("L1: win on final turn after ≤1 correct on previous", () => {
    const guesses = Array(7).fill(undefined).map((_, i) => {
      // Previous turn (index 5): 1 correct digit (slot 0 = "1"),
      // others wrong. Last turn (index 6): wins.
      if (i === 5) return guess("19999");
      if (i === 6) return guess("12345");
      return guess("99999");
    });
    const ctx = baseCtx({
      status: "won",
      target: "12345",
      guesses,
    });
    expect(ach.level1.detect(ctx)).toBe(true);
    expect(ach.level2!.detect(ctx)).toBe(false);
  });
  it("L2: zero correct on previous turn", () => {
    const guesses = Array(7).fill(undefined).map((_, i) => {
      if (i === 5) return guess("99999"); // zero correct
      if (i === 6) return guess("12345"); // win
      return guess("88888");
    });
    const ctx = baseCtx({
      status: "won",
      target: "12345",
      guesses,
    });
    expect(ach.level1.detect(ctx)).toBe(true);
    expect(ach.level2!.detect(ctx)).toBe(true);
  });
  it("does not trigger when win is before final turn", () => {
    const ctx = baseCtx({
      status: "won",
      target: "12345",
      guesses: [guess("99999"), guess("12345")],
    });
    expect(ach.level1.detect(ctx)).toBe(false);
  });
});

// --- Mastery / streaks ---

describe("Veteran", () => {
  const ach = findAch("veteran");
  it("requires win + totalWins ≥ N", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", totalWins: 25 }))).toBe(true);
    expect(ach.level1.detect(baseCtx({ status: "lost", totalWins: 25 }))).toBe(false);
    expect(ach.level2!.detect(baseCtx({ status: "won", totalWins: 100 }))).toBe(true);
  });
});

describe("Streaker", () => {
  const ach = findAch("streaker");
  it("L1: 7-day daily streak, L2: 30-day", () => {
    expect(
      ach.level1.detect(
        baseCtx({ mode: "daily", status: "won", dailyStreakEndingToday: 7 }),
      ),
    ).toBe(true);
    expect(
      ach.level2!.detect(
        baseCtx({ mode: "daily", status: "won", dailyStreakEndingToday: 30 }),
      ),
    ).toBe(true);
    expect(
      ach.level2!.detect(
        baseCtx({ mode: "daily", status: "won", dailyStreakEndingToday: 29 }),
      ),
    ).toBe(false);
  });
});

describe("Hot Hand (5-digit unlimited streaks)", () => {
  const ach = findAch("hotHand");
  it("L1: 10+ streak in any 5-digit bucket", () => {
    const c1 = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 10, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
        "6": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
      },
    });
    expect(ach.level1.detect(c1)).toBe(true);
    const c2 = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 10 },
        },
        "6": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
      },
    });
    expect(ach.level1.detect(c2)).toBe(true);
  });
  it("L2: 20+ streak in 5-digit Hard (manual or auto)", () => {
    const c = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 50, auto: 0 },
          hard: { manual: 20, auto: 0 },
        },
        "6": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
      },
    });
    expect(ach.level2!.detect(c)).toBe(true);
  });
});

describe("Endurance (6-digit unlimited streaks)", () => {
  const ach = findAch("endurance");
  it("L1: 10+ streak in any 6-digit bucket", () => {
    const c = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
        "6": {
          normal: { manual: 10, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
      },
    });
    expect(ach.level1.detect(c)).toBe(true);
  });
  it("L2: 10+ streak in the 6-digit Hard Auto bucket specifically", () => {
    const c = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
        "6": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 10 },
        },
      },
    });
    expect(ach.level2!.detect(c)).toBe(true);
  });
  it("L2 fails when only the Hard Manual streak hits 10", () => {
    const c = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
        "6": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 50, auto: 9 },
        },
      },
    });
    expect(ach.level2!.detect(c)).toBe(false);
  });
});

// --- Resource craft ---

describe("Locked In", () => {
  const ach = findAch("lockedIn");
  it("L1/L2 thresholds", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", locksRemaining: 1 }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", locksRemaining: 2 }))).toBe(true);
  });
});

describe("Locksmith", () => {
  const ach = findAch("locksmith");
  it("counts correct locks; requires win", () => {
    const lockGuess = (locks: { correct: boolean }[]): ResolvedGuessLite => ({
      guess: "11111",
      locks: locks.map((l, i) => ({ slot: i, digit: "1", correct: l.correct })),
    });
    const won2 = baseCtx({
      status: "won",
      guesses: [
        lockGuess([{ correct: true }, { correct: false }]),
        lockGuess([{ correct: true }]),
      ],
    });
    expect(ach.level1.detect(won2)).toBe(true);
    const lost2 = { ...won2, status: "lost" as const };
    expect(ach.level1.detect(lost2)).toBe(false);
  });
});

describe("Lucky Start", () => {
  const ach = findAch("luckyStart");
  it("counts only turn-1 correct locks; requires win", () => {
    const guesses: ResolvedGuessLite[] = [
      {
        guess: "11111",
        locks: [
          { slot: 0, digit: "1", correct: true },
          { slot: 1, digit: "1", correct: true },
        ],
      },
      { guess: "22222" },
    ];
    expect(
      ach.level1.detect(baseCtx({ status: "won", guesses })),
    ).toBe(true);
    expect(
      ach.level2!.detect(baseCtx({ status: "won", guesses })),
    ).toBe(false);
  });
  it("L2: 3+ correct locks on turn 1", () => {
    const guesses: ResolvedGuessLite[] = [
      {
        guess: "11111",
        locks: [
          { slot: 0, digit: "1", correct: true },
          { slot: 1, digit: "1", correct: true },
          { slot: 2, digit: "1", correct: true },
        ],
      },
    ];
    expect(ach.level2!.detect(baseCtx({ status: "won", guesses }))).toBe(true);
  });
});

// --- Clue craft ---

describe("Mercury Rising", () => {
  const ach = findAch("mercuryRising");
  const allRed: ClueResult = { kind: "thermometer", tier: [2, 2, 2, 2, 2] };
  const allBlue: ClueResult = { kind: "thermometer", tier: [0, 0, 0, 0, 0] };
  it("L1: win after all-red thermometer on turn ≤ 2", () => {
    expect(
      ach.level1.detect(
        baseCtx({ status: "won", guesses: [guess("11111", allRed)] }),
      ),
    ).toBe(true);
  });
  it("L2: win after all-blue thermometer on turn ≤ 2", () => {
    expect(
      ach.level2!.detect(
        baseCtx({ status: "won", guesses: [guess("12345", allBlue)] }),
      ),
    ).toBe(true);
  });
  it("does not trigger on a loss", () => {
    expect(
      ach.level1.detect(
        baseCtx({ status: "lost", guesses: [guess("11111", allRed)] }),
      ),
    ).toBe(false);
  });
});

describe("Sweeper", () => {
  const ach = findAch("sweeper");
  it("L1: all but one slot absent", () => {
    const r4: ClueResult = {
      kind: "elimination",
      mask: [true, true, true, true, false],
    };
    expect(ach.level1.detect(baseCtx({ status: "won", guesses: [guess("a", r4)] }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", guesses: [guess("a", r4)] }))).toBe(false);
  });
  it("L2: every slot absent", () => {
    const r5: ClueResult = {
      kind: "elimination",
      mask: [true, true, true, true, true],
    };
    expect(ach.level2!.detect(baseCtx({ status: "won", guesses: [guess("a", r5)] }))).toBe(true);
  });
  it("L1 scales with digits (5 of 6 = all-but-one)", () => {
    const r6: ClueResult = {
      kind: "elimination",
      mask: [true, true, true, true, true, false],
    };
    expect(ach.level1.detect(baseCtx({ status: "won", digits: 6, target: "111111", guesses: [guess("a", r6)] }))).toBe(true);
  });
});

describe("Wide Miss (winners only)", () => {
  const ach = findAch("wideMiss");
  const big: ClueResult = { kind: "sumDelta", delta: -22 };
  it("triggers on win", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", guesses: [guess("a", big)] }))).toBe(true);
  });
  it("does NOT trigger on loss anymore", () => {
    expect(ach.level1.detect(baseCtx({ status: "lost", guesses: [guess("a", big)] }))).toBe(false);
  });
});

describe("Trending Up (winners only)", () => {
  const ach = findAch("trendingUp");
  const r2: ClueResult = { kind: "bullseyeTrend", delta: 2 };
  const r3: ClueResult = { kind: "bullseyeTrend", delta: 3 };
  it("L1/L2 thresholds; win-only", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", guesses: [guess("a", r2)] }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", guesses: [guess("a", r3)] }))).toBe(true);
    expect(ach.level1.detect(baseCtx({ status: "lost", guesses: [guess("a", r2)] }))).toBe(false);
  });
});

describe("Cold Open (no starred clues used)", () => {
  const ach = findAch("coldOpen");
  // Curated set (per lib/game/clueSelector.ts) includes elimination,
  // oracle, thermometer, etc. Non-curated examples include bullseyes
  // and sumDelta.
  it("L1: 5-digit win without any curated/starred clue", () => {
    const guesses: ResolvedGuessLite[] = [
      { guess: "11111", clueId: "bullseyes" },
      { guess: "22222", clueId: "sumDelta" },
    ];
    expect(ach.level1.detect(baseCtx({ status: "won", digits: 5, guesses }))).toBe(true);
  });
  it("L1 fails if any curated clue was used", () => {
    // "elimination" is in ROUND1_CURATED_CLUE_IDS.
    const guesses: ResolvedGuessLite[] = [
      { guess: "11111", clueId: "elimination" },
    ];
    expect(ach.level1.detect(baseCtx({ status: "won", digits: 5, guesses }))).toBe(false);
  });
  it("L2: same rule on 6-digit", () => {
    const guesses: ResolvedGuessLite[] = [
      { guess: "111111", clueId: "bullseyes" },
    ];
    expect(
      ach.level2!.detect(
        baseCtx({ status: "won", digits: 6, target: "111111", guesses }),
      ),
    ).toBe(true);
  });
});

// --- Situational ---

describe("Lucky Target (swapped L1/L2)", () => {
  const ach = findAch("luckyTarget");
  it("L1: ≤3 unique", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", target: "11223" }))).toBe(true);
  });
  it("L2: ≤2 unique", () => {
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "11221" }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "11223" }))).toBe(false);
  });
});

describe("Dice, Dice Baby", () => {
  const ach = findAch("diceDiceBaby");
  it("L1: target is all dice (1-6 only)", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", target: "12345" }))).toBe(true);
    expect(ach.level1.detect(baseCtx({ status: "won", target: "12340" }))).toBe(false);
  });
  it("L2: target has no dice (0/7/8/9 only)", () => {
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "08970" }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "08971" }))).toBe(false);
  });
});

describe("Eleventh Hour (split by digits)", () => {
  const ach = findAch("eleventhHour");
  const oracle: ClueResult = { kind: "oracle", slot: 1, digit: 2 };
  it("L1: only 5-digit", () => {
    const ctx5 = baseCtx({
      status: "won",
      digits: 5,
      target: "12345",
      guesses: [guess("10345", oracle)],
    });
    expect(ach.level1.detect(ctx5)).toBe(true);
    expect(ach.level2!.detect(ctx5)).toBe(false);
  });
  it("L2: only 6-digit", () => {
    const ctx6 = baseCtx({
      status: "won",
      digits: 6,
      target: "123456",
      guesses: [guess("103456", oracle)],
    });
    expect(ach.level1.detect(ctx6)).toBe(false);
    expect(ach.level2!.detect(ctx6)).toBe(true);
  });
});
