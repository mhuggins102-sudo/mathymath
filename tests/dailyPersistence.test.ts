import { describe, it, expect } from "vitest";
import {
  fromSaved,
  toSaved,
  type DailyGameState,
  type UseDailyGameConfig,
} from "@/lib/hooks/useDailyGame";
import { POST as submitResults } from "@/app/api/results/route";
import { generateDailyTarget } from "@/lib/game/targetGenerator";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { getClueById } from "@/lib/game/clues/registry";

const DATE = "2026-04-01";
const TARGET = generateDailyTarget(DATE, 5);
const CONFIG: UseDailyGameConfig = {
  date: DATE,
  digits: 5,
  maxGuesses: 7,
  storageKey: `daily:${DATE}`,
};

describe("daily persistence: toSaved/fromSaved round-trip", () => {
  it("preserves redraws on resolved guesses", () => {
    // Pre-fix: toSaved dropped `redraws`, so a saved-and-reloaded
    // history showed redraws=undefined for every guess. That broke
    // /api/results validation on revisit (clue_not_offered →
    // history_invalid) because the server's deckOffset replay needs
    // each guess's redraw count to advance the pair pointer.
    const state: DailyGameState = {
      date: DATE,
      digits: 5,
      maxGuesses: 7,
      deckOffset: 1,
      status: "playing",
      revealedTarget: null,
      pendingGuess: null,
      guesses: [
        {
          guess: "11111",
          clueId: "sumDelta",
          result: { kind: "sumDelta", delta: 9 },
          redraws: 1,
        },
      ],
    };
    const saved = toSaved(state);
    expect(saved.guesses[0].redraws).toBe(1);
    const restored = fromSaved(saved, CONFIG);
    expect(restored.guesses[0].redraws).toBe(1);
  });

  it("preserves redraws on the pending pair", () => {
    const optionA = getClueById("sumDelta");
    const optionB = getClueById("digitOverlap");
    const state: DailyGameState = {
      date: DATE,
      digits: 5,
      maxGuesses: 7,
      deckOffset: 2,
      status: "playing",
      revealedTarget: null,
      pendingGuess: {
        guess: "22222",
        options: [optionA, optionB],
        redraws: 2,
      },
      guesses: [],
    };
    const saved = toSaved(state);
    expect(saved.pendingGuess?.redraws).toBe(2);
    const restored = fromSaved(saved, CONFIG);
    expect(restored.pendingGuess?.redraws).toBe(2);
  });

  it("survives a JSON round-trip (the actual localStorage path)", () => {
    // The save layer JSON.stringify's the toSaved output and parses on
    // load. Verify redraws makes the trip through that pipe — a plain
    // object round-trip can hide a typing bug that JSON doesn't.
    const state: DailyGameState = {
      date: DATE,
      digits: 5,
      maxGuesses: 7,
      deckOffset: 1,
      status: "won",
      revealedTarget: TARGET,
      pendingGuess: null,
      guesses: [
        {
          guess: "11111",
          clueId: "sumDelta",
          result: { kind: "sumDelta", delta: 9 },
          redraws: 1,
        },
        {
          guess: TARGET,
          clueId: "bullseyes",
          result: getClueById("bullseyes").compute(TARGET, TARGET),
        },
      ],
    };
    const json = JSON.stringify(toSaved(state));
    const parsed = JSON.parse(json);
    const restored = fromSaved(parsed, CONFIG);
    expect(restored.guesses[0].redraws).toBe(1);
    expect(restored.guesses[1].redraws).toBeUndefined();
  });

  it("re-submitting a hydrated history with a redraw still validates against /api/results", async () => {
    // End-to-end: build a winning history where round 1 used a redraw,
    // simulate the localStorage round-trip, then POST the restored
    // history to /api/results and assert it's accepted (200). Pre-fix
    // this hit history_invalid because the round-trip stripped
    // redraws and the server's pickTwoClues replay no longer matched
    // the player's actual round-1 pick.
    //
    // After 1 redraw on round 1, the offered pair is deck[2]/deck[3].
    const r1Pair = pickTwoClues(DATE, [], 1);
    const r1Clue = r1Pair[0];
    const winningState: DailyGameState = {
      date: DATE,
      digits: 5,
      maxGuesses: 7,
      deckOffset: 1,
      status: "won",
      revealedTarget: TARGET,
      pendingGuess: null,
      guesses: [
        {
          guess: "11111",
          clueId: r1Clue.id,
          result: r1Clue.compute("11111", TARGET),
          redraws: 1,
        },
        {
          guess: TARGET,
          clueId: "bullseyes",
          result: getClueById("bullseyes").compute(TARGET, TARGET),
        },
      ],
    };
    // Round-trip through the save/load pipeline.
    const restored = fromSaved(
      JSON.parse(JSON.stringify(toSaved(winningState))),
      CONFIG,
    );
    // Build the resubmit payload exactly like DailyGame.tsx does.
    const payload = {
      clientId: "00000000-0000-4000-8000-000000000000",
      puzzleDate: DATE,
      history: restored.guesses.map((g) => ({
        guess: g.guess,
        clueId: g.clueId,
        result: g.result,
        locks: g.locks,
        redraws: g.redraws,
      })),
    };
    const req = new Request("http://localhost/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res = await submitResults(req);
    expect(res.status).toBe(200);
  });
});
