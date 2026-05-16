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
    totalWins: 0,
    locksRemaining: 0,
    redrawsUsed: 0,
    dailyStreakEndingToday: 0,
    ...overrides,
  };
}

function guess(g: string, result?: ClueResult, extras: Partial<ResolvedGuessLite> = {}): ResolvedGuessLite {
  return { guess: g, result, ...extras };
}

describe("registry", () => {
  it("contains exactly 14 themes with unique ids", () => {
    expect(ACHIEVEMENTS.length).toBe(14);
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(14);
  });
  it("sums to 25 unlock slots (11 dual-level + 3 single-level)", () => {
    let slots = 0;
    let single = 0;
    for (const a of ACHIEVEMENTS) {
      slots += a.level2 ? 2 : 1;
      if (!a.level2) single++;
    }
    expect(slots).toBe(25);
    expect(single).toBe(3);
  });
});

describe("Speedrun", () => {
  const ach = findAch("speedrun");
  it("L1: win in 4 turns", () => {
    const ctx = baseCtx({ status: "won", guesses: Array(4).fill(guess("11111")) });
    expect(ach.level1.detect(ctx)).toBe(true);
    expect(ach.level2!.detect(ctx)).toBe(false);
  });
  it("L2: win in 3 turns", () => {
    const ctx = baseCtx({ status: "won", guesses: Array(3).fill(guess("11111")) });
    expect(ach.level1.detect(ctx)).toBe(true);
    expect(ach.level2!.detect(ctx)).toBe(true);
  });
  it("loss never triggers", () => {
    const ctx = baseCtx({ status: "lost", guesses: Array(3).fill(guess("11111")) });
    expect(ach.level1.detect(ctx)).toBe(false);
    expect(ach.level2!.detect(ctx)).toBe(false);
  });
});

describe("Locked In", () => {
  const ach = findAch("lockedIn");
  it("L1 at 1 lock remaining, L2 at 2", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", locksRemaining: 1 }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", locksRemaining: 1 }))).toBe(false);
    expect(ach.level2!.detect(baseCtx({ status: "won", locksRemaining: 2 }))).toBe(true);
  });
});

describe("Daily Sprint", () => {
  const ach = findAch("dailySprint");
  it("only counts daily mode", () => {
    const fastWin = { status: "won" as const, guesses: Array(4).fill(guess("11111")) };
    expect(ach.level1.detect(baseCtx({ ...fastWin, mode: "unlimited" }))).toBe(false);
    expect(ach.level1.detect(baseCtx({ ...fastWin, mode: "daily" }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ ...fastWin, mode: "daily" }))).toBe(true);
  });
});

describe("Veteran", () => {
  const ach = findAch("veteran");
  it("counts on total wins", () => {
    expect(ach.level1.detect(baseCtx({ totalWins: 25 }))).toBe(true);
    expect(ach.level1.detect(baseCtx({ totalWins: 24 }))).toBe(false);
    expect(ach.level2!.detect(baseCtx({ totalWins: 100 }))).toBe(true);
  });
});

describe("Iron Player", () => {
  const ach = findAch("ironPlayer");
  it("requires 6-digit Hard Auto AND fast win", () => {
    const ctxOK = baseCtx({
      status: "won",
      digits: 6,
      advancedMode: true,
      preselectedMode: true,
      guesses: Array(5).fill(guess("111111")),
      target: "111111",
    });
    expect(ach.level1.detect(ctxOK)).toBe(true);
    // Missing one of the flags
    expect(
      ach.level1.detect({ ...ctxOK, advancedMode: false }),
    ).toBe(false);
    expect(
      ach.level1.detect({ ...ctxOK, preselectedMode: false }),
    ).toBe(false);
    expect(ach.level1.detect({ ...ctxOK, digits: 5 })).toBe(false);
  });
});

describe("Eleventh Hour", () => {
  const ach = findAch("eleventhHour");
  it("triggers when Oracle reveal supplies the only missing slot", () => {
    // Target = "12345", player's last guess "10345" — every slot
    // matches except slot 1; Oracle reveals slot 1 = 2.
    const oracle: ClueResult = { kind: "oracle", slot: 1, digit: 2 };
    const ctx = baseCtx({
      status: "won",
      target: "12345",
      guesses: [guess("10345", oracle)],
    });
    expect(ach.level1.detect(ctx)).toBe(true);
  });
  it("does not trigger when other slots also differ", () => {
    const oracle: ClueResult = { kind: "oracle", slot: 1, digit: 2 };
    const ctx = baseCtx({
      status: "won",
      target: "12345",
      guesses: [guess("19349", oracle)], // slot 4 also differs
    });
    expect(ach.level1.detect(ctx)).toBe(false);
  });
});

describe("Mercury Rising", () => {
  const ach = findAch("mercuryRising");
  it("L1: all-red thermometer on turn ≤ 2", () => {
    const allRed: ClueResult = { kind: "thermometer", tier: [2, 2, 2, 2, 2] };
    expect(
      ach.level1.detect(baseCtx({ guesses: [guess("11111", allRed)] })),
    ).toBe(true);
  });
  it("L2: all-blue thermometer on turn ≤ 2", () => {
    const allBlue: ClueResult = { kind: "thermometer", tier: [0, 0, 0, 0, 0] };
    expect(
      ach.level2!.detect(baseCtx({ guesses: [guess("12345", allBlue)] })),
    ).toBe(true);
  });
  it("ignores thermometer rolled on turn 3+", () => {
    const allRed: ClueResult = { kind: "thermometer", tier: [2, 2, 2, 2, 2] };
    expect(
      ach.level1.detect(
        baseCtx({
          guesses: [
            guess("a"),
            guess("b"),
            guess("c", allRed),
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe("Sweeper", () => {
  const ach = findAch("sweeper");
  it("L1/L2 thresholds on Elimination mask", () => {
    const elim4: ClueResult = {
      kind: "elimination",
      mask: [true, true, true, true, false],
    };
    const elim5: ClueResult = {
      kind: "elimination",
      mask: [true, true, true, true, true],
    };
    expect(ach.level1.detect(baseCtx({ guesses: [guess("a", elim4)] }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ guesses: [guess("a", elim4)] }))).toBe(false);
    expect(ach.level2!.detect(baseCtx({ guesses: [guess("a", elim5)] }))).toBe(true);
  });
});

describe("Wide Miss", () => {
  const ach = findAch("wideMiss");
  it("triggers on |delta| ≥ N (wins OR losses)", () => {
    const big: ClueResult = { kind: "sumDelta", delta: -22 };
    const huge: ClueResult = { kind: "sumDelta", delta: 27 };
    expect(ach.level1.detect(baseCtx({ status: "lost", guesses: [guess("a", big)] }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "lost", guesses: [guess("a", big)] }))).toBe(false);
    expect(ach.level2!.detect(baseCtx({ status: "lost", guesses: [guess("a", huge)] }))).toBe(true);
  });
});

describe("Lucky Target", () => {
  const ach = findAch("luckyTarget");
  it("L1: target ≤3 unique digits on win", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", target: "11223" }))).toBe(true);
  });
  it("L2: target ≤2 unique digits on win", () => {
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "11221" }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ status: "won", target: "11223" }))).toBe(false);
  });
  it("loss never triggers", () => {
    expect(ach.level1.detect(baseCtx({ status: "lost", target: "11111" }))).toBe(false);
  });
});

describe("Dice-Free", () => {
  const ach = findAch("diceFree");
  it("triggers on target with no 1-6 digits", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", target: "08970" }))).toBe(true);
  });
  it("does not trigger if any dice digit appears", () => {
    expect(ach.level1.detect(baseCtx({ status: "won", target: "08971" }))).toBe(false);
  });
});

describe("Locksmith", () => {
  const ach = findAch("locksmith");
  it("counts correct locks across all guesses", () => {
    const g = (locks: { correct: boolean }[]): ResolvedGuessLite => ({
      guess: "11111",
      locks: locks.map((l, i) => ({ slot: i, digit: "1", correct: l.correct })),
    });
    const ctx = baseCtx({
      guesses: [
        g([{ correct: true }, { correct: false }]),
        g([{ correct: true }]),
      ],
    });
    expect(ach.level1.detect(ctx)).toBe(true); // 2 correct
    expect(ach.level2!.detect(ctx)).toBe(false);
    const ctx3 = baseCtx({
      guesses: [
        g([{ correct: true }, { correct: true }, { correct: true }]),
      ],
    });
    expect(ach.level2!.detect(ctx3)).toBe(true);
  });
});

describe("Trending Up", () => {
  const ach = findAch("trendingUp");
  it("L1: bullseyeTrend delta ≥ 2", () => {
    const r: ClueResult = { kind: "bullseyeTrend", delta: 2 };
    expect(ach.level1.detect(baseCtx({ guesses: [guess("a", r)] }))).toBe(true);
    expect(ach.level2!.detect(baseCtx({ guesses: [guess("a", r)] }))).toBe(false);
  });
  it("L2: ≥ 3", () => {
    const r: ClueResult = { kind: "bullseyeTrend", delta: 3 };
    expect(ach.level2!.detect(baseCtx({ guesses: [guess("a", r)] }))).toBe(true);
  });
});

describe("Streaker", () => {
  const ach = findAch("streaker");
  it("only counts daily mode + 7-day streak", () => {
    expect(
      ach.level1.detect(
        baseCtx({ mode: "daily", dailyStreakEndingToday: 7 }),
      ),
    ).toBe(true);
    expect(
      ach.level1.detect(
        baseCtx({ mode: "unlimited", dailyStreakEndingToday: 7 }),
      ),
    ).toBe(false);
    expect(
      ach.level1.detect(
        baseCtx({ mode: "daily", dailyStreakEndingToday: 6 }),
      ),
    ).toBe(false);
  });
});
