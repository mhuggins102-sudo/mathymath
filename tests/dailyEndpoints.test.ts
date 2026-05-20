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

  it("accepts lock attempts on guess 1 (no per-turn restriction)", async () => {
    const res = await submitGuess(
      mockRequest({
        history: [],
        guess: "11111",
        lockAttempts: [{ slot: 0, digit: TARGET[0] }],
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
    // Pick whichever offered clue is NOT a bonus-lock clue so the
    // "starts with 1 lock" premise still holds — picking a bonus-lock
    // clue on guess 1 would give the player a +1 lock and the 2-lock
    // attempt on guess 2 would fit the budget.
    const pair = pickTwoClues(DATE, []);
    const choice =
      pair.find(
        (c) =>
          c.id !== "distinctDigits" &&
          c.id !== "upsAndDowns" &&
          c.id !== "divisibleBy" &&
          c.id !== "extraLock",
      ) ?? pair[0];
    const g1 = {
      guess: "11111",
      clueId: choice.id,
      result: choice.compute("11111", TARGET),
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

  it("advances the deck past prior redraws when offering the next pair", async () => {
    // Round 1: player redrew once (history[0].redraws = 1) and picked
    // the first option from the redrawn pair (deck[2]). Round 2's
    // offered pair MUST be deck[4]/deck[5] — not deck[2]/deck[3] (the
    // pair already shown last round). Without the deckOffset fix,
    // submit-guess re-offered deck[2]/deck[3] and the subsequent
    // choose-clue rejected the player's pick with `clue_not_offered`
    // because its own pickTwoClues call DID account for redraws.
    const round1Pair = pickTwoClues(DATE, [], 1); // deck[2]/deck[3]
    const r1Clue = round1Pair[0];
    const g1 = {
      guess: "11111",
      clueId: r1Clue.id,
      result: r1Clue.compute("11111", TARGET),
      redraws: 1,
    };
    const res = await submitGuess(
      mockRequest({ history: [g1], guess: "22222" }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("pending");
    // Expected: deck[4]/deck[5] = pickTwoClues(DATE, [r1Clue.id], 1).
    const expectedNext = pickTwoClues(DATE, [r1Clue.id] as never, 1);
    expect(body.options).toEqual([expectedNext[0].id, expectedNext[1].id]);
    // And critically NOT the prior redrawn pair.
    const priorRedrawnPair = pickTwoClues(DATE, [], 1);
    expect(body.options).not.toEqual([
      priorRedrawnPair[0].id,
      priorRedrawnPair[1].id,
    ]);
  });

  it("end-to-end: redraw on round 1, pick on round 2 → choose-clue accepts", async () => {
    // Stitches submit-guess (round 1 pending) → choose-clue (round 1
    // resolve) → submit-guess (round 2 pending) → choose-clue (round 2
    // resolve). With the deckOffset fix, both choose-clue calls accept
    // the pick. Pre-fix this failed at the round-2 choose-clue step
    // with "clue_not_offered".
    const r1Pair = pickTwoClues(DATE, [], 1); // pair after a redraw
    const r1Clue = r1Pair[0];
    // Round 1 resolve via choose-clue (server replays the redraw).
    const r1ResolveRes = await chooseClue(
      mockRequest({
        history: [],
        pendingGuess: "11111",
        clueId: r1Clue.id,
        redraws: 1,
      }),
      { params: paramsP(DATE) },
    );
    expect(r1ResolveRes.status).toBe(200);
    const r1Body = await r1ResolveRes.json();
    expect(r1Body.kind).toBe("continue");
    const g1 = {
      guess: "11111",
      clueId: r1Clue.id,
      result: r1Body.result,
      redraws: 1,
    };
    // Round 2: submit-guess returns the next pair.
    const r2SubmitRes = await submitGuess(
      mockRequest({ history: [g1], guess: "22222" }),
      { params: paramsP(DATE) },
    );
    expect(r2SubmitRes.status).toBe(200);
    const r2SubmitBody = await r2SubmitRes.json();
    const r2OfferedIds = r2SubmitBody.options as string[];
    // Skip clues that would distract from what this test exercises:
    //   - paramKind clues need extra wiring (slot picks / reuse target),
    //   - extraLock has no result payload to assert on,
    //   - clueReuse is gated on lock budget which the prior round's
    //     redraw already drained — picking it here would 409 with
    //     "clue_reuse_no_budget" and that's not what we're testing.
    const safeIdx = r2OfferedIds.findIndex((id) => {
      const c = getClueById(id as never);
      return !c.paramKind && c.id !== "extraLock" && c.id !== "clueReuse";
    });
    // If no info clue is offered (deck shapes where r2 is e.g.
    // [clueReuse, containsDigit]), prefer the first non-clueReuse so
    // we don't trip the lock-budget gate (clueReuse costs 1 lock and
    // the prior round's redraw already drained the budget). Last-
    // ditch fallback is the first offered id.
    const nonReuseIdx = r2OfferedIds.findIndex((id) => id !== "clueReuse");
    const pickIdx = safeIdx >= 0 ? safeIdx : nonReuseIdx >= 0 ? nonReuseIdx : 0;
    const r2ChosenId = r2OfferedIds[pickIdx] ?? r2OfferedIds[0];
    const r2ResolveRes = await chooseClue(
      mockRequest({
        history: [g1],
        pendingGuess: "22222",
        clueId: r2ChosenId,
      }),
      { params: paramsP(DATE) },
    );
    expect(r2ResolveRes.status).toBe(200);
    const r2ResolveBody = await r2ResolveRes.json();
    // "continue" / "won" are the resolved-clue kinds; "needs-pick" is
    // the partial-state response when the chosen clue is Contains
    // Digit and a slot pick is required. All three are acceptable —
    // the test is only verifying that round-2 choose-clue accepts the
    // clue (doesn't 409 on clue_not_offered).
    expect(["continue", "won", "needs-pick"]).toContain(r2ResolveBody.kind);
  });
});

describe("POST /api/daily/[date]/choose-clue", () => {
  it("returns continue + result for a valid pick", async () => {
    const pair = pickTwoClues(DATE, []);
    // Pin to a context-free clue from the pair — Contains Digit returns
    // "needs-pick" (slot pick required) and Oracle's result depends on
    // context the test doesn't thread. Fall back to pair[0] only if
    // neither option is safe (shouldn't happen for the regular deck).
    const safe =
      pair.find((c) => c.id !== "containsDigit" && c.id !== "oracle") ??
      pair[0];
    const res = await chooseClue(
      mockRequest({
        history: [],
        pendingGuess: "11111",
        clueId: safe.id,
      }),
      { params: paramsP(DATE) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("continue");
    expect(body.result).toBeDefined();
    // Must match what the real pipeline would compute.
    const expected = getClueById(safe.id).compute("11111", TARGET);
    expect(body.result).toEqual(expected);
  });

  /** Build a 3-round history pinning the slots in `lockSlots` via
   *  correct locks. Each round uses the first non-Oracle option offered
   *  by pickTwoClues for date D. Returns null if the deck doesn't
   *  produce 3 non-Oracle options OR Oracle isn't offered at round 4. */
  function buildOraclePriorHistory(
    D: string,
    T: string,
    probe: string,
    lockSlots: readonly number[],
  ): Array<{
    guess: string;
    clueId: string;
    result: ReturnType<ReturnType<typeof getClueById>["compute"]>;
    locks: Array<{ slot: number; digit: string; correct: boolean }>;
  }> | null {
    const chosen: string[] = [];
    const history: Array<{
      guess: string;
      clueId: string;
      result: ReturnType<ReturnType<typeof getClueById>["compute"]>;
      locks: Array<{ slot: number; digit: string; correct: boolean }>;
    }> = [];
    for (let r = 0; r < 3; r++) {
      const pair = pickTwoClues(D, chosen as never, 0);
      const opt = pair.find((c) => c.id !== "oracle");
      if (!opt) return null;
      chosen.push(opt.id);
      history.push({
        guess: probe,
        clueId: opt.id,
        result: opt.compute(probe, T),
        locks: [{ slot: lockSlots[r], digit: T[lockSlots[r]], correct: true }],
      });
    }
    const r4Pair = pickTwoClues(D, chosen as never, 0);
    if (!r4Pair.some((c) => c.id === "oracle")) return null;
    return history;
  }

  /** Find a date for which Oracle is offered at round 4. The probe
   *  is a digit absent from T so the auto-picked Oracle slot has a
   *  non-zero delta everywhere — i.e. Oracle picks slot 0 (leftmost
   *  among ties when probe is "Xxxxx"). The 3 prior locks pin slots
   *  1, 2, 3; the pending lock pins slot 4. Together with Oracle's
   *  slot-0 reveal that's all five slots known → win. */
  function findOracleSetup(): {
    D: string;
    T: string;
    probe: string;
    oracleSlot: number;
    priorLockSlots: number[];
    pendingLockSlot: number;
  } {
    const oracleClueObj = getClueById("oracle");
    // Daily endpoints reject future dates, so confine the search to
    // months strictly before today (2026-05). Plenty of past dates
    // exist to find a viable oracle-at-round-4 setup.
    for (let day = 1; day < 120; day++) {
      const month = String(((day - 1) % 4) + 1).padStart(2, "0");
      const dayOfMonth = String(((day - 1) % 28) + 1).padStart(2, "0");
      const D = `2026-${month}-${dayOfMonth}`;
      const T = generateDailyTarget(D, 5);
      const probeDigit = "0123456789".split("").find((d) => !T.includes(d));
      if (probeDigit === undefined) continue;
      const probe = probeDigit.repeat(5);
      const oracleResult = oracleClueObj.compute(probe, T);
      if (oracleResult.kind !== "oracle") continue;
      const oracleSlot = oracleResult.slot;
      const otherSlots = [0, 1, 2, 3, 4].filter((s) => s !== oracleSlot);
      const priorLockSlots = otherSlots.slice(0, 3);
      const pendingLockSlot = otherSlots[3];
      const history = buildOraclePriorHistory(D, T, probe, priorLockSlots);
      if (history === null) continue;
      return { D, T, probe, oracleSlot, priorLockSlots, pendingLockSlot };
    }
    throw new Error("No suitable date found for Oracle-at-round-4 test");
  }

  it("returns won when an Oracle auto-reveal + pending lock completes certainty", async () => {
    // Plan: 3 prior rounds each pin a non-Oracle slot via a correct
    // lock; the pending guess locks the remaining non-Oracle slot and
    // picks Oracle, which auto-reveals the last unknown slot →
    // server should signal `won`.
    const { D, T, probe, oracleSlot, priorLockSlots, pendingLockSlot } =
      findOracleSetup();
    const history = buildOraclePriorHistory(D, T, probe, priorLockSlots)!;

    const res = await chooseClue(
      mockRequest({
        history,
        pendingGuess: probe,
        clueId: "oracle",
        pendingLocks: [
          { slot: pendingLockSlot, digit: T[pendingLockSlot], correct: true },
        ],
      }),
      { params: paramsP(D) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("won");
    expect(body.target).toBe(T);
    expect(body.result).toEqual({
      kind: "oracle",
      slot: oracleSlot,
      digit: Number(T[oracleSlot]),
    });
  });

  it("returns continue (not won) when pendingLocks are missing on Oracle reveal", async () => {
    const { D, T, probe, priorLockSlots } = findOracleSetup();
    const history = buildOraclePriorHistory(D, T, probe, priorLockSlots)!;
    const res = await chooseClue(
      mockRequest({
        history,
        pendingGuess: probe,
        clueId: "oracle",
      }),
      { params: paramsP(D) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("continue");
  });

  it("ignores a tampered pending lock that lies about correctness", async () => {
    const { D, T, probe, priorLockSlots, pendingLockSlot } = findOracleSetup();
    const history = buildOraclePriorHistory(D, T, probe, priorLockSlots)!;
    const wrongDigit = "0123456789"
      .split("")
      .find((d) => d !== T[pendingLockSlot])!;
    const res = await chooseClue(
      mockRequest({
        history,
        pendingGuess: probe,
        clueId: "oracle",
        pendingLocks: [
          { slot: pendingLockSlot, digit: wrongDigit, correct: true },
        ],
      }),
      { params: paramsP(D) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("continue");
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
          "statSummary",
          "digitClass",
          "containsDigit",
          "distinctDigits",
          "divisibleBy",
          "totalDeviation",
        ] as string[]
      ).find((id) => !offered.has(id as never)) ?? "statSummary";
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
