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
  it("every theme exposes either L1+L2 or a criteria list (no single-level)", () => {
    for (const a of ACHIEVEMENTS) {
      const isCriteria =
        Array.isArray(a.criteria) && a.criteria.length >= 2;
      const isTwoLevel = !!a.level1 && !!a.level2;
      expect(isCriteria || isTwoLevel, `${a.id} must have L1+L2 or ≥2 criteria`).toBe(true);
    }
  });
});

// --- Speed ---

describe("Speedrun (unlimited-only)", () => {
  const ach = findAch("speedrun");
  it("triggers on unlimited win in ≤4 / ≤3", () => {
    expect(
      ach.level1!.detect(
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
    expect(ach.level1!.detect(ctx)).toBe(false);
    expect(ach.level2!.detect(ctx)).toBe(false);
  });
});

describe("Daily Sprint (daily-only)", () => {
  const ach = findAch("dailySprint");
  it("L1/L2 thresholds", () => {
    expect(
      ach.level1!.detect(
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
    expect(ach.level1!.detect(ok)).toBe(true);
    expect(ach.level1!.detect({ ...ok, advancedMode: false })).toBe(false);
    expect(ach.level1!.detect({ ...ok, preselectedMode: false })).toBe(false);
    expect(ach.level1!.detect({ ...ok, digits: 5 })).toBe(false);
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
    expect(ach.level1!.detect(ctx)).toBe(true);
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
    expect(ach.level1!.detect(ctx)).toBe(true);
    expect(ach.level2!.detect(ctx)).toBe(true);
  });
  it("does not trigger when win is before final turn", () => {
    const ctx = baseCtx({
      status: "won",
      target: "12345",
      guesses: [guess("99999"), guess("12345")],
    });
    expect(ach.level1!.detect(ctx)).toBe(false);
  });
});

// --- Mastery / streaks ---

describe("Veteran", () => {
  const ach = findAch("veteran");
  it("requires win + totalWins ≥ N", () => {
    expect(ach.level1!.detect(baseCtx({ status: "won", totalWins: 25 }))).toBe(true);
    expect(ach.level1!.detect(baseCtx({ status: "lost", totalWins: 25 }))).toBe(false);
    expect(ach.level2!.detect(baseCtx({ status: "won", totalWins: 100 }))).toBe(true);
  });
});

describe("Streaker", () => {
  const ach = findAch("streaker");
  it("L1: 7-day daily streak, L2: 30-day", () => {
    expect(
      ach.level1!.detect(
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
    expect(ach.level1!.detect(c1)).toBe(true);
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
    expect(ach.level1!.detect(c2)).toBe(true);
  });
  it("L2: 10+ streak in 5-digit Hard Auto specifically", () => {
    const c = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 50, auto: 0 },
          hard: { manual: 0, auto: 10 },
        },
        "6": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
      },
    });
    expect(ach.level2!.detect(c)).toBe(true);
  });
  it("L2 fails when only the 5-digit Hard Manual streak hits 10", () => {
    const c = baseCtx({
      mode: "unlimited",
      status: "won",
      unlimitedStreakByBucket: {
        "5": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 50, auto: 9 },
        },
        "6": {
          normal: { manual: 0, auto: 0 },
          hard: { manual: 0, auto: 0 },
        },
      },
    });
    expect(ach.level2!.detect(c)).toBe(false);
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
    expect(ach.level1!.detect(c)).toBe(true);
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
  it("L1: requires ≥2 locks remaining; L2: requires ≥3", () => {
    expect(ach.level1!.detect(baseCtx({ status: "won", locksRemaining: 1 }))).toBe(false);
    expect(ach.level1!.detect(baseCtx({ status: "won", locksRemaining: 2 }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", locksRemaining: 2 }))).toBe(false);
    expect(ach.level2!.detect(baseCtx({ status: "won", locksRemaining: 3 }))).toBe(true);
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
    expect(ach.level1!.detect(won2)).toBe(true);
    const lost2 = { ...won2, status: "lost" as const };
    expect(ach.level1!.detect(lost2)).toBe(false);
  });
});

describe("Lucky Start", () => {
  const ach = findAch("luckyStart");
  it("counts turn-1 correct digits regardless of locking; requires win", () => {
    // Target 12345; guess 12399 matches at slots 0,1,2 → 3 correct.
    const guesses: ResolvedGuessLite[] = [{ guess: "12399" }, { guess: "22222" }];
    expect(
      ach.level1!.detect(baseCtx({ status: "won", target: "12345", guesses })),
    ).toBe(true);
    expect(
      ach.level2!.detect(baseCtx({ status: "won", target: "12345", guesses })),
    ).toBe(true);
  });
  it("L1 fires on 2 correct, L2 needs 3", () => {
    // Target 12345; guess 12999 → 2 correct.
    const guesses: ResolvedGuessLite[] = [{ guess: "12999" }];
    expect(
      ach.level1!.detect(baseCtx({ status: "won", target: "12345", guesses })),
    ).toBe(true);
    expect(
      ach.level2!.detect(baseCtx({ status: "won", target: "12345", guesses })),
    ).toBe(false);
  });
  it("ignores whether digits were locked or not", () => {
    // Same shape as the original test (with locks present) — still
    // counts as ≥2 correct on turn 1 → L1 passes.
    const guesses: ResolvedGuessLite[] = [
      {
        guess: "12999",
        locks: [{ slot: 0, digit: "1", correct: true }],
      },
    ];
    expect(
      ach.level1!.detect(baseCtx({ status: "won", target: "12345", guesses })),
    ).toBe(true);
  });
  it("requires status=won", () => {
    const guesses: ResolvedGuessLite[] = [{ guess: "12345" }];
    expect(
      ach.level1!.detect(baseCtx({ status: "lost", target: "12345", guesses })),
    ).toBe(false);
  });
});

// --- Clue craft ---

describe("Mercury Rising (criteria-based: silver=any, gold=both)", () => {
  const ach = findAch("mercuryRising");
  const allRed: ClueResult = { kind: "thermometer", tier: [2, 2, 2, 2, 2] };
  const allBlue: ClueResult = { kind: "thermometer", tier: [0, 0, 0, 0, 0] };
  it("uses the criteria schema, not level1/level2", () => {
    expect(ach.criteria).toBeDefined();
    expect(ach.criteria!.length).toBe(2);
    expect(ach.level1).toBeUndefined();
    expect(ach.level2).toBeUndefined();
  });
  it("all-red criterion fires on turn ≤ 2 in a win", () => {
    const cr = ach.criteria!.find((c) => c.id === "allRed");
    expect(cr).toBeDefined();
    expect(
      cr!.detect(baseCtx({ status: "won", guesses: [guess("11111", allRed)] })),
    ).toBe(true);
  });
  it("all-blue criterion fires on turn ≤ 2 in a win", () => {
    const cr = ach.criteria!.find((c) => c.id === "allBlue");
    expect(cr).toBeDefined();
    expect(
      cr!.detect(baseCtx({ status: "won", guesses: [guess("12345", allBlue)] })),
    ).toBe(true);
  });
  it("does not trigger on a loss", () => {
    for (const cr of ach.criteria!) {
      expect(
        cr.detect(
          baseCtx({ status: "lost", guesses: [guess("11111", allRed)] }),
        ),
      ).toBe(false);
    }
  });
});

describe("Sweeper", () => {
  const ach = findAch("sweeper");
  it("L1: all but one slot absent", () => {
    const r4: ClueResult = {
      kind: "elimination",
      mask: [true, true, true, true, false],
    };
    expect(ach.level1!.detect(baseCtx({ status: "won", guesses: [guess("a", r4)] }))).toBe(true);
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
    expect(ach.level1!.detect(baseCtx({ status: "won", digits: 6, target: "111111", guesses: [guess("a", r6)] }))).toBe(true);
  });
});

describe("Wide Miss (5-digit, manual clue mode, winners only)", () => {
  const ach = findAch("wideMiss");
  const big: ClueResult = { kind: "sumDelta", delta: -22 };
  it("triggers on 5-digit manual win", () => {
    expect(
      ach.level1!.detect(
        baseCtx({
          status: "won",
          digits: 5,
          preselectedMode: false,
          guesses: [guess("a", big)],
        }),
      ),
    ).toBe(true);
  });
  it("does NOT trigger on loss", () => {
    expect(
      ach.level1!.detect(
        baseCtx({
          status: "lost",
          digits: 5,
          preselectedMode: false,
          guesses: [guess("a", big)],
        }),
      ),
    ).toBe(false);
  });
  it("does NOT trigger in preselected (auto) clue mode", () => {
    expect(
      ach.level1!.detect(
        baseCtx({
          status: "won",
          digits: 5,
          preselectedMode: true,
          guesses: [guess("a", big)],
        }),
      ),
    ).toBe(false);
  });
  it("does NOT trigger on 6-digit games", () => {
    expect(
      ach.level1!.detect(
        baseCtx({
          status: "won",
          digits: 6,
          target: "123456",
          preselectedMode: false,
          guesses: [guess("a", big)],
        }),
      ),
    ).toBe(false);
  });
});

describe("Trending Up (5-digit, winners only)", () => {
  const ach = findAch("trendingUp");
  const r2: ClueResult = { kind: "bullseyeTrend", delta: 2 };
  const r3: ClueResult = { kind: "bullseyeTrend", delta: 3 };
  it("L1/L2 thresholds; win-only; 5-digit only", () => {
    expect(
      ach.level1!.detect(
        baseCtx({ status: "won", digits: 5, guesses: [guess("a", r2)] }),
      ),
    ).toBe(true);
    expect(
      ach.level2!.detect(
        baseCtx({ status: "won", digits: 5, guesses: [guess("a", r3)] }),
      ),
    ).toBe(true);
    expect(
      ach.level1!.detect(
        baseCtx({ status: "lost", digits: 5, guesses: [guess("a", r2)] }),
      ),
    ).toBe(false);
    expect(
      ach.level1!.detect(
        baseCtx({
          status: "won",
          digits: 6,
          target: "123456",
          guesses: [guess("a", r2)],
        }),
      ),
    ).toBe(false);
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
    expect(ach.level1!.detect(baseCtx({ status: "won", digits: 5, guesses }))).toBe(true);
  });
  it("L1 fails if any curated clue was used", () => {
    // "elimination" is in ROUND1_CURATED_CLUE_IDS.
    const guesses: ResolvedGuessLite[] = [
      { guess: "11111", clueId: "elimination" },
    ];
    expect(ach.level1!.detect(baseCtx({ status: "won", digits: 5, guesses }))).toBe(false);
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
    expect(ach.level1!.detect(baseCtx({ status: "won", target: "11223" }))).toBe(true);
  });
  it("L2: ≤2 unique", () => {
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "11221" }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "11223" }))).toBe(false);
  });
});

describe("Dice, Dice Baby (criteria-based)", () => {
  const ach = findAch("diceDiceBaby");
  it("uses the criteria schema with allDice + noDice prongs", () => {
    expect(ach.criteria).toBeDefined();
    expect(ach.criteria!.map((c) => c.id).sort()).toEqual(["allDice", "noDice"]);
  });
  it("allDice fires on a target with only 1-6 digits", () => {
    const cr = ach.criteria!.find((c) => c.id === "allDice")!;
    expect(cr.detect(baseCtx({ status: "won", target: "12345" }))).toBe(true);
    expect(cr.detect(baseCtx({ status: "won", target: "12340" }))).toBe(false);
  });
  it("noDice fires on a target with no 1-6 digits", () => {
    const cr = ach.criteria!.find((c) => c.id === "noDice")!;
    expect(cr.detect(baseCtx({ status: "won", target: "08970" }))).toBe(true);
    expect(cr.detect(baseCtx({ status: "won", target: "08971" }))).toBe(false);
  });
});

describe("Eleventh Hour (criteria-based: 5-digit + 6-digit prongs)", () => {
  const ach = findAch("eleventhHour");
  const oracle: ClueResult = { kind: "oracle", slot: 1, digit: 2 };
  it("uses the criteria schema with fiveDigit + sixDigit prongs", () => {
    expect(ach.criteria).toBeDefined();
    expect(ach.criteria!.map((c) => c.id).sort()).toEqual([
      "fiveDigit",
      "sixDigit",
    ]);
  });
  it("fiveDigit prong fires only on 5-digit wins", () => {
    const cr = ach.criteria!.find((c) => c.id === "fiveDigit")!;
    const ctx5 = baseCtx({
      status: "won",
      digits: 5,
      target: "12345",
      guesses: [guess("10345", oracle)],
    });
    expect(cr.detect(ctx5)).toBe(true);
    const ctx6 = baseCtx({
      status: "won",
      digits: 6,
      target: "123456",
      guesses: [guess("103456", oracle)],
    });
    expect(cr.detect(ctx6)).toBe(false);
  });
  it("sixDigit prong fires only on 6-digit wins", () => {
    const cr = ach.criteria!.find((c) => c.id === "sixDigit")!;
    const ctx6 = baseCtx({
      status: "won",
      digits: 6,
      target: "123456",
      guesses: [guess("103456", oracle)],
    });
    expect(cr.detect(ctx6)).toBe(true);
    const ctx5 = baseCtx({
      status: "won",
      digits: 5,
      target: "12345",
      guesses: [guess("10345", oracle)],
    });
    expect(cr.detect(ctx5)).toBe(false);
  });
});
