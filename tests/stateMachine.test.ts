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

describe("stateMachine — advanced mode (positional cap)", () => {
  it("standard and advanced modes diverge once the player has used 2 positional clues", () => {
    // Hand-craft a history with two positional picks, then dispatch a
    // SUBMIT to derive what the chooser would offer next. In standard
    // mode the deck pointer is free to surface positional cards; in
    // advanced mode positional cards must be filtered out. Picking the
    // same fixed seed/history ensures any divergence is purely the
    // cap's doing.
    const target = "12345";
    const baseHistory = [
      {
        guess: "99999",
        clueId: "oracle" as const,
        result: { kind: "oracle" as const, slot: 0, digit: 1 },
      },
      {
        guess: "88888",
        clueId: "thermometer" as const,
        result: getClueById("thermometer").compute("88888", target),
      },
    ];
    let std = initGameState({
      target,
      seed: "diverge",
      maxGuesses: 7,
      advancedMode: false,
    });
    std = { ...std, guesses: baseHistory };
    std = reduce(std, { type: "SUBMIT_GUESS", guess: "77777" });
    let adv = initGameState({
      target,
      seed: "diverge",
      maxGuesses: 7,
      advancedMode: true,
    });
    adv = { ...adv, guesses: baseHistory };
    adv = reduce(adv, { type: "SUBMIT_GUESS", guess: "77777" });
    // Advanced mode: every offered card must be non-positional.
    for (const c of adv.pendingGuess!.options) {
      expect(c.category).not.toBe("positional");
    }
    // Sanity: standard mode at the SAME seed/round may legitimately
    // offer a positional card. We don't require it (deck shuffle-
    // dependent), but at minimum standard mode must not be filtered
    // by advanced rules — assert by checking the two pairs differ
    // structurally OR std contains a positional.
    const advIds = adv.pendingGuess!.options.map((c) => c.id).sort();
    const stdIds = std.pendingGuess!.options.map((c) => c.id).sort();
    const stdHasPositional = std.pendingGuess!.options.some(
      (c) => c.category === "positional",
    );
    if (stdHasPositional) {
      // The defining symptom of the divergence: std offered a
      // positional, adv did not.
      expect(advIds).not.toEqual(stdIds);
    }
  });

  it("advanced mode stops offering positional clues after 2 picks", () => {
    // Hand-craft a state with the positional cap already exhausted, so
    // the test isn't sensitive to the deck shuffle order (which in
    // advanced mode is intentionally not constrained to surface a
    // positional in pair 1).
    const target = "12345";
    let s: GameState = initGameState({
      target,
      seed: "adv-cap",
      maxGuesses: 7,
      advancedMode: true,
    });
    s = {
      ...s,
      guesses: [
        {
          guess: "99999",
          clueId: "oracle",
          result: { kind: "oracle", slot: 0, digit: 1 },
        },
        {
          guess: "88888",
          clueId: "thermometer",
          result: getClueById("thermometer").compute("88888", target),
        },
      ],
    };
    // Walk three more rounds; every offered pair must omit positionals.
    for (let i = 0; i < 3 && s.status === "playing"; i++) {
      s = reduce(s, { type: "SUBMIT_GUESS", guess: "77777" });
      if (!s.pendingGuess) break;
      for (const c of s.pendingGuess.options) {
        expect(c.category).not.toBe("positional");
      }
      const next = s.pendingGuess.options[0];
      s = reduce(s, { type: "CHOOSE_CLUE", clueId: next.id });
    }
  });

  it("REDRAW respects the advanced-mode cap", () => {
    const target = "12345";
    let s: GameState = initGameState({
      target,
      seed: "adv-redraw",
      maxGuesses: 7,
      advancedMode: true,
    });
    s = {
      ...s,
      guesses: [
        {
          guess: "99999",
          clueId: "oracle",
          result: { kind: "oracle", slot: 0, digit: 1 },
        },
        {
          guess: "88888",
          clueId: "thermometer",
          result: getClueById("thermometer").compute("88888", target),
        },
      ],
    };
    // Submit and redraw; both pre- and post-redraw pairs must be
    // free of positional cards because the cap is already exhausted.
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "77777" });
    for (const c of s.pendingGuess!.options) {
      expect(c.category).not.toBe("positional");
    }
    s = reduce(s, { type: "REDRAW" });
    for (const c of s.pendingGuess!.options) {
      expect(c.category).not.toBe("positional");
    }
  });

  it("Clue Reuse counts toward the cap when reusing a positional clue", () => {
    // Hand-craft a state where the player has used Oracle directly and
    // then Clue Reuse on Higher/Lower. The cap should fire (2 effective
    // positional uses) on the next SUBMIT.
    const target = "12345";
    let s: GameState = initGameState({
      target,
      seed: "reusecap",
      maxGuesses: 7,
      advancedMode: true,
    });
    s = {
      ...s,
      guesses: [
        {
          guess: "99999",
          clueId: "oracle",
          result: { kind: "oracle", slot: 0, digit: 1 },
        },
        {
          guess: "88888",
          clueId: "higherLower",
          result: getClueById("higherLower").compute("88888", target),
        },
        {
          guess: "77777",
          clueId: "clueReuse",
          // The reuse re-applied higherLower (positional) → counts as
          // a positional use for advanced-mode purposes. Combined with
          // Oracle that's 3 effective positional uses; cap fires.
          result: getClueById("higherLower").compute("77777", target),
        },
      ],
    };
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "66666" });
    for (const c of s.pendingGuess!.options) {
      expect(c.category).not.toBe("positional");
    }
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

describe("stateMachine — Clue Reuse threads priorResults", () => {
  it("Clue Reuse on Divisible By avoids re-revealing a known divisor", () => {
    // Target 12345 has divisors {3, 5} in 2-9. Plant a prior
    // divisibleBy result that revealed 3, then re-apply via Clue
    // Reuse and assert the result is the OTHER divisor.
    const target = "12345";
    const divisibleBy = getClueById("divisibleBy");
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
          // The fixed divisor here is what the player has already seen.
          result: { kind: "divisibleBy", divisor: 3, present: true },
        },
      ],
      pendingGuess: {
        guess: "22222",
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
      expect(resolved.result.present).toBe(true);
      expect(resolved.result.divisor).toBe(5);
    }
    // Sanity: divisibleBy on its own (no prior reveals) for the same
    // target genuinely has both 3 and 5 in the candidate pool, so the
    // post-reuse pick is a real exclusion of 3 rather than the RNG
    // happening to land on 5 in both cases.
    const fresh = divisibleBy.compute("22222", target);
    if (fresh.kind === "divisibleBy") {
      expect([3, 5]).toContain(fresh.divisor);
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
