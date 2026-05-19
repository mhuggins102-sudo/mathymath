import { describe, it, expect } from "vitest";
import { validateDailyHistory } from "@/lib/api/dailyValidation";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { BONUS_LOCK_CLUE_IDS } from "@/lib/game/locks";
import type { ClueId } from "@/lib/game/clues/types";

const TARGET = "47628";
const SEED = "2026-04-15";
const DIGITS = 5;
const MAX = 8;

/** Build one "honest" resolved guess by asking the real clue pipeline
 *  what the next offered pair is, picking an option, and computing the
 *  real result against the target. Prefers clues whose compute is
 *  purely a function of (guess, target) — skipping Special (would
 *  grant +1 lock and skew budget math), Oracle (result depends on
 *  context.knownSlots), and bonus-lock clues (each pick grants +1
 *  lock and would inflate the budget the tests assume). Falls back to
 *  the first option if neither fits. */
function honestGuess(
  chosen: ClueId[],
  guess: string,
): { guess: string; clueId: ClueId; result: unknown } {
  const pair = pickTwoClues(SEED, chosen);
  const clue =
    pair.find(
      (c) =>
        c.category !== "special" &&
        c.id !== "oracle" &&
        !BONUS_LOCK_CLUE_IDS.has(c.id),
    ) ?? pair[0];
  const result = clue.compute(guess, TARGET);
  return { guess, clueId: clue.id, result };
}

describe("validateDailyHistory", () => {
  it("accepts an empty history as still-playing", () => {
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe("playing");
      expect(r.chosenClueIds).toEqual([]);
    }
  });

  it("accepts a legitimate partial history", () => {
    const g1 = honestGuess([], "11111");
    const g2 = honestGuess([g1.clueId], "22222");
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [g1, g2],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe("playing");
      expect(r.chosenClueIds).toEqual([g1.clueId, g2.clueId]);
    }
  });

  it("accepts an exact-match terminal history as won", () => {
    const g1 = honestGuess([], "11111");
    const winGuess = {
      guess: TARGET,
      clueId: "bullseyes" as const,
      result: getClueById("bullseyes").compute(TARGET, TARGET),
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [g1, winGuess],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("won");
  });

  it("accepts a final-wrong-guess terminal history as lost", () => {
    const chosen: ClueId[] = [];
    const body: { guess: string; clueId?: ClueId; result?: unknown }[] = [];
    for (let i = 0; i < MAX - 1; i++) {
      const g = honestGuess(chosen, String(i).padStart(DIGITS, "0"));
      chosen.push(g.clueId);
      body.push(g);
    }
    body.push({ guess: "99999" }); // final wrong, no clue
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: body,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("lost");
  });

  it("rejects a tampered result (claiming a better clue outcome)", () => {
    const g1 = honestGuess([], "11111");
    const tampered = {
      ...g1,
      result:
        g1.clueId === "bullseyes"
          ? { kind: "bullseyes", hits: [true, true, true, true, true] }
          : { ...(g1.result as Record<string, unknown>), __tampered: true },
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [tampered],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/result_mismatch/);
  });

  it("rejects a clue that was not offered at that step", () => {
    const pair = pickTwoClues(SEED, []);
    // Pick any clue id that is NOT in the offered pair.
    const offeredIds = new Set<ClueId>(pair.map((c) => c.id));
    const all: ClueId[] = [
      "bullseyes",
      "higherLower",
      "within2",
      "parityMask",
      "oracle",
      "thermometer",
      "sumDelta",
      "digitOverlap",
      "statSummary",
      "digitClass",
      "containsDigit",
      "distinctDigits",
      "divisibleBy",
      "totalDeviation",
    ];
    const notOffered = all.find((id) => !offeredIds.has(id));
    expect(notOffered).toBeDefined();
    const clue = getClueById(notOffered!);
    const result = clue.compute("11111", TARGET);
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [{ guess: "11111", clueId: notOffered!, result }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/clue_not_offered/);
  });

  it("rejects a final wrong guess that claims a clue", () => {
    const chosen: ClueId[] = [];
    const body: { guess: string; clueId?: ClueId; result?: unknown }[] = [];
    for (let i = 0; i < MAX - 1; i++) {
      const g = honestGuess(chosen, String(i).padStart(DIGITS, "0"));
      chosen.push(g.clueId);
      body.push(g);
    }
    // Final wrong guess with a (forged) clue attached — should fail.
    const forged = honestGuess(chosen, "99999");
    body.push(forged);
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: body,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/final_wrong_guess_has_clue/);
  });

  it("rejects a history longer than maxGuesses", () => {
    const body = Array.from({ length: MAX + 1 }, () => ({ guess: "11111" }));
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: body,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("history_too_long");
  });

  it("rejects non-digit / wrong-length guesses", () => {
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [{ guess: "ab345" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid_guess/);
  });

  it("accepts a correctly-claimed lock on guess 2", () => {
    // Guess 1: honest. Guess 2: a correct lock at slot 0 (target[0] = "4").
    const g1 = honestGuess([], "11111");
    const g2 = honestGuess([g1.clueId], "22222");
    const withLocks = {
      ...g2,
      locks: [{ slot: 0, digit: "4", correct: true }],
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [g1, withLocks],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a lie about lock correctness", () => {
    const g1 = honestGuess([], "11111");
    const g2 = honestGuess([g1.clueId], "22222");
    // Target at slot 0 is "4", so claiming "9" with correct=true is a lie.
    const tampered = {
      ...g2,
      locks: [{ slot: 0, digit: "9", correct: true }],
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [g1, tampered],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/lock_correctness_mismatch/);
  });

  it("accepts a correctly-claimed lock on guess 1 (no per-turn restriction)", () => {
    const g1 = honestGuess([], "11111");
    const withLock = {
      ...g1,
      locks: [{ slot: 0, digit: TARGET[0], correct: true }],
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [withLock],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects exceeding the lock budget", () => {
    // Player starts with 1 lock. Using 2 locks in one turn without an
    // Extra Lock is over-budget.
    const g1 = honestGuess([], "11111");
    const g2 = honestGuess([g1.clueId], "22222");
    const cheater = {
      ...g2,
      locks: [
        { slot: 0, digit: "4", correct: true },
        { slot: 1, digit: "7", correct: true },
      ],
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [g1, cheater],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/locks_budget_exceeded/);
  });

  it("rejects two locks on the same slot", () => {
    const g1 = honestGuess([], "11111");
    const g2 = honestGuess([g1.clueId], "22222");
    const dupe = {
      ...g2,
      locks: [
        { slot: 0, digit: "4", correct: true },
        { slot: 0, digit: "5", correct: false },
      ],
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [g1, dupe],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/lock_duplicate_slot/);
  });

  it("a wrong lock spends the budget so the next turn has none", () => {
    const g1 = honestGuess([], "11111");
    const g2 = honestGuess([g1.clueId], "22222");
    const wrongLock = {
      ...g2,
      locks: [{ slot: 0, digit: "9", correct: false }], // target[0]="4"
    };
    // Guess 3: try to use another lock. Budget is now 0.
    const g3 = honestGuess([g1.clueId, g2.clueId], "33333");
    const overBudget = {
      ...g3,
      locks: [{ slot: 1, digit: "7", correct: true }],
    };
    const r = validateDailyHistory({
      target: TARGET,
      digits: DIGITS,
      maxGuesses: MAX,
      seed: SEED,
      history: [g1, wrongLock, overBudget],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/locks_budget_exceeded/);
  });
});
