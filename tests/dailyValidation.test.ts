import { describe, it, expect } from "vitest";
import { validateDailyHistory } from "@/lib/api/dailyValidation";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import type { ClueId } from "@/lib/game/clues/types";

const TARGET = "47628";
const SEED = "2026-04-15";
const DIGITS = 5;
const MAX = 8;

/** Build one "honest" resolved guess by asking the real clue pipeline
 *  what the next offered pair is, picking the first option, and
 *  computing the real result against the target. */
function honestGuess(
  chosen: ClueId[],
  guess: string,
): { guess: string; clueId: ClueId; result: unknown } {
  const pair = pickTwoClues(SEED, chosen);
  const clue = pair[0];
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
      "parityBalance",
      "primeCount",
      "rangeCompare",
      "containsDigit",
      "distinctDigits",
      "median",
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
});
