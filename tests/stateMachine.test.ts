import { describe, it, expect } from "vitest";
import {
  initGameState,
  maxGuessesForDigits,
  reduce,
  type GameState,
} from "@/lib/game/stateMachine";
import { getClueById } from "@/lib/game/clues/registry";

describe("stateMachine", () => {
  it("wins on exact match without showing clue options", () => {
    let s = initGameState({ target: "12345", seed: "t" });
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "12345" });
    expect(s.status).toBe("won");
    expect(s.pendingGuess).toBeNull();
    expect(s.guesses).toHaveLength(1);
  });

  it("enters pending state then resolves on CHOOSE_CLUE", () => {
    let s = initGameState({ target: "12345", seed: "t" });
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "99999" });
    expect(s.pendingGuess).not.toBeNull();
    const chosen = s.pendingGuess!.options[0];
    s = reduce(s, { type: "CHOOSE_CLUE", clueId: chosen.id });
    expect(s.pendingGuess).toBeNull();
    expect(s.status).toBe("playing");
    expect(s.guesses[0].clueId).toBe(chosen.id);
  });

  it("loses after maxGuesses wrong guesses; final guess skips the clue chooser", () => {
    let s = initGameState({ target: "12345", seed: "t", maxGuesses: 3 });
    // Non-final wrong guesses: clue chooser appears.
    for (let i = 0; i < 2; i++) {
      s = reduce(s, { type: "SUBMIT_GUESS", guess: "99999" });
      expect(s.pendingGuess).not.toBeNull();
      const opt = s.pendingGuess!.options[0];
      s = reduce(s, { type: "CHOOSE_CLUE", clueId: opt.id });
    }
    // Final wrong guess: no clue offered, game ends immediately.
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "99999" });
    expect(s.pendingGuess).toBeNull();
    expect(s.status).toBe("lost");
    expect(s.guesses).toHaveLength(3);
    expect(s.guesses[2].clueId).toBeUndefined();
    expect(s.guesses[2].result).toBeUndefined();
  });

  it("wins on exact match even on the final guess", () => {
    let s = initGameState({ target: "12345", seed: "t", maxGuesses: 2 });
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "99999" });
    const opt = s.pendingGuess!.options[0];
    s = reduce(s, { type: "CHOOSE_CLUE", clueId: opt.id });
    // Now on the last guess slot.
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "12345" });
    expect(s.status).toBe("won");
    expect(s.guesses).toHaveLength(2);
  });

  it("ignores SUBMIT_GUESS while pending", () => {
    let s = initGameState({ target: "12345", seed: "t" });
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "11111" });
    const before = s;
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "22222" });
    expect(s).toBe(before);
  });

  it("resolves lock attempts against the real target", () => {
    let s = initGameState({ target: "12345", seed: "t" });
    s = reduce(s, {
      type: "SUBMIT_GUESS",
      guess: "99999",
      locks: [
        { slot: 0, digit: "1" }, // correct (target[0] = "1")
        { slot: 2, digit: "7" }, // wrong (target[2] = "3")
      ],
    });
    // The pending guess carries resolved locks through to CHOOSE_CLUE.
    expect(s.pendingGuess).not.toBeNull();
    expect(s.pendingGuess!.locks).toEqual([
      { slot: 0, digit: "1", correct: true },
      { slot: 2, digit: "7", correct: false },
    ]);
    // After picking a clue, the locks land on the resolved guess.
    const chosen = s.pendingGuess!.options[0];
    s = reduce(s, { type: "CHOOSE_CLUE", clueId: chosen.id });
    expect(s.guesses[0].locks).toEqual([
      { slot: 0, digit: "1", correct: true },
      { slot: 2, digit: "7", correct: false },
    ]);
  });

  it("records locks on an exact-match win", () => {
    let s = initGameState({ target: "12345", seed: "t" });
    s = reduce(s, {
      type: "SUBMIT_GUESS",
      guess: "12345",
      locks: [{ slot: 0, digit: "1" }],
    });
    expect(s.status).toBe("won");
    expect(s.guesses[0].locks).toEqual([
      { slot: 0, digit: "1", correct: true },
    ]);
  });

  it("records locks on a final-wrong-guess loss", () => {
    let s = initGameState({ target: "12345", seed: "t", maxGuesses: 1 });
    s = reduce(s, {
      type: "SUBMIT_GUESS",
      guess: "99999",
      locks: [{ slot: 3, digit: "4" }], // correct
    });
    expect(s.status).toBe("lost");
    expect(s.guesses[0].locks).toEqual([
      { slot: 3, digit: "4", correct: true },
    ]);
  });

  it("leaves `locks` undefined when no attempts were made", () => {
    let s = initGameState({ target: "12345", seed: "t" });
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "99999" });
    const chosen = s.pendingGuess!.options[0];
    s = reduce(s, { type: "CHOOSE_CLUE", clueId: chosen.id });
    expect(s.guesses[0].locks).toBeUndefined();
  });

  it("Oracle wins immediately when it reveals the last unknown slot", () => {
    // Pre-stage 4 correct locks across prior guesses so only slot 4 is
    // unknown, then choose Oracle on slot 4. Game should transition to
    // "won" without requiring the player to submit the matching guess.
    const oracle = getClueById("oracle");
    const sumDelta = getClueById("sumDelta");
    const state: GameState = {
      target: "12345",
      digits: 5,
      maxGuesses: 7,
      seed: "t",
      deckOffset: 0,
      offeredClueIds: [],
      advancedMode: false,
      preselectedDeck: null,
      status: "playing",
      guesses: [
        { guess: "00000", clueId: "sumDelta", result: { kind: "sumDelta", delta: 15 } },
        { guess: "00000", clueId: "sumDelta", result: { kind: "sumDelta", delta: 15 }, locks: [{ slot: 0, digit: "1", correct: true }] },
        { guess: "10000", clueId: "sumDelta", result: { kind: "sumDelta", delta: 14 }, locks: [{ slot: 1, digit: "2", correct: true }] },
        { guess: "12000", clueId: "sumDelta", result: { kind: "sumDelta", delta: 12 }, locks: [{ slot: 2, digit: "3", correct: true }] },
        { guess: "12300", clueId: "sumDelta", result: { kind: "sumDelta", delta: 9 }, locks: [{ slot: 3, digit: "4", correct: true }] },
      ],
      pendingGuess: {
        guess: "12340",
        options: [oracle, sumDelta] as [typeof oracle, typeof sumDelta],
        redraws: 0,
      },
    };
    const next = reduce(state, {
      type: "CHOOSE_CLUE",
      clueId: "oracle",
      param: { selectedSlot: 4 },
    });
    expect(next.status).toBe("won");
    expect(next.pendingGuess).toBeNull();
  });

  it("Oracle does NOT win when it leaves slots still unknown", () => {
    const oracle = getClueById("oracle");
    const sumDelta = getClueById("sumDelta");
    const state: GameState = {
      target: "12345",
      digits: 5,
      maxGuesses: 7,
      seed: "t",
      deckOffset: 0,
      offeredClueIds: [],
      advancedMode: false,
      preselectedDeck: null,
      status: "playing",
      guesses: [
        { guess: "00000", clueId: "sumDelta", result: { kind: "sumDelta", delta: 15 } },
      ],
      pendingGuess: {
        guess: "11111",
        options: [oracle, sumDelta] as [typeof oracle, typeof sumDelta],
        redraws: 0,
      },
    };
    const next = reduce(state, {
      type: "CHOOSE_CLUE",
      clueId: "oracle",
      param: { selectedSlot: 0 },
    });
    expect(next.status).toBe("playing");
  });
});


describe("maxGuessesForDigits", () => {
  it("returns 7 for the 5-digit puzzle", () => {
    expect(maxGuessesForDigits(5)).toBe(7);
  });
  it("returns 7 for the 6-digit puzzle (same budget as 5-digit)", () => {
    expect(maxGuessesForDigits(6)).toBe(7);
  });
  it("falls back to the default for unlisted digit counts", () => {
    expect(maxGuessesForDigits(4)).toBe(7);
  });
});

describe("stateMachine — Clue Reuse on Divisible By", () => {
  it("re-applies Divisible By to the new guess, producing the (target ÷, guess ÷) intersection", () => {
    // Target 12345 → 2-9 divisors {3, 5}. New guess 24630 → 2-9
    // divisors {2, 3, 5, 6}. Intersection: {3, 5}.
    const target = "12345";
    const clueReuse = getClueById("clueReuse");
    const sumDelta = getClueById("sumDelta");
    const state: GameState = {
      target,
      digits: 5,
      maxGuesses: 7,
      seed: "reuse-divis",
      deckOffset: 0,
      offeredClueIds: ["divisibleBy", "sumDelta", "clueReuse", "thermometer"],
      advancedMode: false,
      preselectedDeck: null,
      status: "playing",
      guesses: [
        {
          guess: "11111",
          clueId: "divisibleBy",
          // Prior result against guess 11111 (divisors 2-9: {}); no
          // overlap with target's {3, 5}.
          result: { kind: "divisibleBy", divisors: [], targetHasAny: true },
        },
      ],
      pendingGuess: {
        guess: "24630",
        options: [clueReuse, sumDelta] as [typeof clueReuse, typeof sumDelta],
        redraws: 0,
      },
    };
    const next = reduce(state, {
      type: "CHOOSE_CLUE",
      clueId: "clueReuse",
      param: { reusedClueId: "divisibleBy" } as never,
    });
    const resolved = next.guesses[next.guesses.length - 1];
    expect(resolved.result?.kind).toBe("divisibleBy");
    if (resolved.result?.kind === "divisibleBy") {
      expect(resolved.result.divisors).toEqual([3, 5]);
      expect(resolved.result.targetHasAny).toBe(true);
    }
  });
});

describe("stateMachine — no duplicate clue offers (advanced mode)", () => {
  it("never re-offers a previously-offered clue across a full advanced game", () => {
    // Walk many seeds to a 7-round advanced-mode finish, picking an
    // option each round. After each SUBMIT/CHOOSE pair, every id ever
    // offered must be unique — this is the bug the offeredClueIds
    // exclusion fixes. Pre-fix, after the positional cap the walk-
    // forward path could leak a card from the next pair's region,
    // which then re-appeared as the next round's deck head.
    for (let s = 0; s < 100; s++) {
      const seed = `nodup-${s}`;
      let state: GameState = initGameState({
        target: "12345",
        seed,
        maxGuesses: 7,
        advancedMode: true,
      });
      const sawTwice: string[] = [];
      const seen = new Set<string>();
      for (let round = 0; round < 6 && state.status === "playing"; round++) {
        state = reduce(state, { type: "SUBMIT_GUESS", guess: "99999" });
        if (!state.pendingGuess) break;
        for (const c of state.pendingGuess.options) {
          if (seen.has(c.id)) sawTwice.push(c.id);
          seen.add(c.id);
        }
        // Prefer picking a positional clue when available so the cap
        // fires early and we exercise the post-cap walk-forward path.
        const positional = state.pendingGuess.options.find(
          (c) => c.category === "positional",
        );
        const pick = positional ?? state.pendingGuess.options[0];
        state = reduce(state, { type: "CHOOSE_CLUE", clueId: pick.id });
      }
      expect(sawTwice).toEqual([]);
    }
  });

  it("REDRAW does not re-offer the just-burned pair", () => {
    // A REDRAW replaces the current pendingGuess.options with a fresh
    // pair drawn from the next deck slot. The burned pair is still
    // "offered" — it must not re-appear in the new options.
    for (let s = 0; s < 50; s++) {
      const seed = `redraw-nodup-${s}`;
      let state: GameState = initGameState({
        target: "12345",
        seed,
        maxGuesses: 7,
        advancedMode: true,
      });
      state = reduce(state, { type: "SUBMIT_GUESS", guess: "99999" });
      const burned = new Set(
        state.pendingGuess!.options.map((c) => c.id),
      );
      state = reduce(state, { type: "REDRAW" });
      for (const c of state.pendingGuess!.options) {
        expect(burned.has(c.id)).toBe(false);
      }
    }
  });

  it("offeredClueIds tracks every option ever shown", () => {
    let state: GameState = initGameState({
      target: "12345",
      seed: "track-offered",
      maxGuesses: 7,
      advancedMode: true,
    });
    expect(state.offeredClueIds).toEqual([]);
    state = reduce(state, { type: "SUBMIT_GUESS", guess: "99999" });
    expect(state.offeredClueIds).toHaveLength(2);
    const offeredAfterSubmit = new Set(state.offeredClueIds);
    for (const c of state.pendingGuess!.options) {
      expect(offeredAfterSubmit.has(c.id)).toBe(true);
    }
    state = reduce(state, { type: "REDRAW" });
    expect(state.offeredClueIds).toHaveLength(4);
  });
});
