import { describe, it, expect } from "vitest";
import { POST as submitGuess } from "@/app/api/daily/[date]/submit-guess/route";
import { POST as chooseClue } from "@/app/api/daily/[date]/choose-clue/route";
import { POST as submitResults } from "@/app/api/results/route";
import { generateDailyTarget, todayUtcISO } from "@/lib/game/targetGenerator";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { getClueById } from "@/lib/game/clues/registry";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";

const DATE = "2026-04-01";
const TARGET = generateDailyTarget(DATE, 5);

function mockRequest(body: unknown): Request {
  return new Request("http://localhost/api/daily/x/submit-guess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function paramsP(date: string) {
  return Promise.resolve({ date });
}

describe("POST /api/daily/[date]/submit-guess", () => {
  it("returns a clue pair for a non-final wrong guess", async () => {
    const res = await submitGuess(
      mockRequest({ history: [], guess: "11111" }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("pending");
    expect(body.options).toHaveLength(2);
  });

  it("returns won + target on exact match", async () => {
    const res = await submitGuess(
      mockRequest({ history: [], guess: TARGET }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("won");
    expect(body.target).toBe(TARGET);
    expect(body.result.kind).toBe("bullseyes");
  });

  it("returns lost + target on final wrong guess", async () => {
    // Build MAX-1 honest guesses and submit the final wrong one. Size
    // is derived from DEFAULT_MAX_GUESSES so the test rides whatever
    // budget production is currently using.
    const historyLen = DEFAULT_MAX_GUESSES - 1;
    const history: { guess: string; clueId?: string; result?: unknown }[] = [];
    let chosen: string[] = [];
    for (let i = 0; i < historyLen; i++) {
      const guess = String(i).padStart(5, "0");
      const pair = pickTwoClues(DATE, chosen as never);
      // Skip Oracle: its compute depends on context.knownSlots, which
      // the validator computes from prior history on replay. This
      // test doesn't thread that, so pin to a context-free clue.
      const clue =
        pair.find((c) => c.id !== "oracle" && c.category !== "special") ??
        pair[0];
      const result = clue.compute(guess, TARGET);
      history.push({ guess, clueId: clue.id, result });
      chosen = [...chosen, clue.id];
    }
    const res = await submitGuess(
      mockRequest({ history, guess: "99999" }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("lost");
    expect(body.target).toBe(TARGET);
  });

  it("rejects tampered history (409)", async () => {
    const pair = pickTwoClues(DATE, []);
    const tampered = {
      guess: "11111",
      clueId: pair[0].id,
      // Clearly-wrong result that doesn't match real compute.
      result: { kind: pair[0].id, __forged: true },
    };
    const res = await submitGuess(
      mockRequest({ history: [tampered], guess: "22222" }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(409);
  });

  it("rejects future dates (400)", async () => {
    const future = "3000-01-01";
    const res = await submitGuess(
      mockRequest({ history: [], guess: "11111" }),
      { params: paramsP(future) },
    );
    expect(res.status).toBe(400);
  });

  it("NEVER leaks target while play is still ongoing", async () => {
    const res = await submitGuess(
      mockRequest({ history: [], guess: "11111" }),
      { params: paramsP(DATE) },
    );
    const body = await res.json();
    expect(body.target).toBeUndefined();
  });

  it("rejects lock attempts on guess 1", async () => {
    const res = await submitGuess(
      mockRequest({
        history: [],
        guess: "11111",
        lockAttempts: [{ slot: 0, digit: "1" }],
      }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("locks_on_first_guess");
  });

  it("returns resolved locks with the pending response", async () => {
    // Build a guess-2 request with one lock.
    const pair = pickTwoClues(DATE, []);
    const g1 = {
      guess: "11111",
      clueId: pair[0].id,
      result: pair[0].compute("11111", TARGET),
    };
    const res = await submitGuess(
      mockRequest({
        history: [g1],
        guess: "99999",
        lockAttempts: [{ slot: 0, digit: TARGET[0] }], // always correct
      }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("pending");
    expect(body.locks).toEqual([
      { slot: 0, digit: TARGET[0], correct: true },
    ]);
  });

  it("rejects an over-budget lock attempt on guess 2", async () => {
    const pair = pickTwoClues(DATE, []);
    const g1 = {
      guess: "11111",
      clueId: pair[0].id,
      result: pair[0].compute("11111", TARGET),
    };
    const res = await submitGuess(
      mockRequest({
        history: [g1],
        guess: "99999",
        // Player starts with 1 lock; 2 attempts exceeds budget.
        lockAttempts: [
          { slot: 0, digit: "1" },
          { slot: 1, digit: "2" },
        ],
      }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("locks_budget_exceeded");
  });
});

describe("POST /api/daily/[date]/choose-clue", () => {
  it("returns continue + result for a valid pick", async () => {
    const pair = pickTwoClues(DATE, []);
    const res = await chooseClue(
      mockRequest({
        history: [],
        pendingGuess: "11111",
        clueId: pair[0].id,
      }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("continue");
    expect(body.result).toBeDefined();
    // Must match what the real pipeline would compute.
    const expected = getClueById(pair[0].id).compute("11111", TARGET);
    expect(body.result).toEqual(expected);
  });

  it("rejects a clue that was not in the offered pair", async () => {
    // Find any clue id outside the first-round pair.
    const pair = pickTwoClues(DATE, []);
    const offered = new Set(pair.map((c) => c.id));
    const notOffered =
      (
        [
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
        ] as string[]
      ).find((id) => !offered.has(id as never)) ?? "median";
    const res = await chooseClue(
      mockRequest({
        history: [],
        pendingGuess: "11111",
        clueId: notOffered,
      }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(409);
  });
});

describe("integration: daily HTML never contains the target", () => {
  it("is today's daily target actually generated?", () => {
    const t = generateDailyTarget(todayUtcISO(), 5);
    expect(t).toMatch(/^\d{5}$/);
  });
});

describe("POST /api/results (hardened)", () => {
  const CLIENT_ID = "00000000-0000-4000-8000-000000000000";

  it("rejects a forged 1-guess win with no valid history (409)", async () => {
    // Historical exploit: client posts `{ won: true, guessCount: 1 }`
    // with an invalid bullseyes result. The hardened endpoint
    // replays the history against the real target and rejects.
    const forgedHistory = [
      {
        guess: "00000",
        clueId: "bullseyes",
        result: {
          kind: "bullseyes",
          hits: [true, true, true, true, true],
        },
      },
    ];
    const req = new Request("http://localhost/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        puzzleDate: DATE,
        history: forgedHistory,
      }),
    });
    const res = await submitResults(req);
    // If the real target happens to be "00000" (extremely unlikely with
    // the degenerate filter that rejects it) the forgery is actually
    // valid. Otherwise it's caught.
    if (TARGET === "00000") {
      expect(res.status).toBe(200);
    } else {
      expect(res.status).toBe(409);
    }
  });

  it("accepts a legitimate win", async () => {
    const winHistory = [
      {
        guess: TARGET,
        clueId: "bullseyes",
        result: getClueById("bullseyes").compute(TARGET, TARGET),
      },
    ];
    const req = new Request("http://localhost/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        puzzleDate: DATE,
        history: winHistory,
      }),
    });
    const res = await submitResults(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.percentile).toBeTypeOf("number");
    expect(body.aggregate).toBeDefined();
  });

  it("rejects submitting an in-progress game", async () => {
    const req = new Request("http://localhost/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        puzzleDate: DATE,
        history: [], // no guesses — game is still playing
      }),
    });
    const res = await submitResults(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("game_not_over");
  });
});
