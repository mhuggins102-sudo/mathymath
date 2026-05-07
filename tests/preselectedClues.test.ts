import { describe, it, expect } from "vitest";
import {
  buildPreselectedDeck,
  ROUND1_CURATED_CLUE_IDS,
} from "@/lib/game/clueSelector";
import { initGameState, reduce } from "@/lib/game/stateMachine";
import { getClueById } from "@/lib/game/clues/registry";

describe("buildPreselectedDeck", () => {
  it("regular mode: slot 0 is from the curated round-1 set, deck has 6 distinct clues", () => {
    const deck = buildPreselectedDeck("seed-A", 6, false);
    expect(deck.length).toBe(6);
    expect(ROUND1_CURATED_CLUE_IDS.has(deck[0])).toBe(true);
    expect(new Set(deck).size).toBe(6);
    for (const id of deck) {
      expect(getClueById(id).category).not.toBe("special");
    }
  });

  it("regular mode: deterministic for the same seed", () => {
    const a = buildPreselectedDeck("seed-B", 6, false);
    const b = buildPreselectedDeck("seed-B", 6, false);
    expect(a).toEqual(b);
  });

  it("advanced mode: 6 distinct info clues, no specials, no curated guarantee", () => {
    for (let i = 0; i < 50; i++) {
      const deck = buildPreselectedDeck(`adv-${i}`, 6, true);
      expect(deck.length).toBe(6);
      expect(new Set(deck).size).toBe(6);
      for (const id of deck) {
        expect(getClueById(id).category).not.toBe("special");
      }
    }
  });

  it("advanced mode: slot 0 is sometimes a non-curated clue (no slot-0 guarantee)", () => {
    let sawNonCuratedAt0 = false;
    for (let i = 0; i < 200; i++) {
      const deck = buildPreselectedDeck(`adv-noncurated-${i}`, 6, true);
      if (!ROUND1_CURATED_CLUE_IDS.has(deck[0])) {
        sawNonCuratedAt0 = true;
        break;
      }
    }
    expect(sawNonCuratedAt0).toBe(true);
  });
});

describe("preselected mode reducer", () => {
  it("auto-resolves a non-paramKind clue on submit (no chooser)", () => {
    const target = "12345";
    const state = initGameState({
      target,
      seed: "preselect-1",
      maxGuesses: 7,
      preselectedClues: true,
    });
    expect(state.preselectedDeck).not.toBeNull();
    expect(state.preselectedDeck!.length).toBe(6);

    const next = reduce(state, { type: "SUBMIT_GUESS", guess: "98765" });
    // If the assigned clue has no paramKind, the row should be in
    // state.guesses with a result; pendingGuess should be null.
    const clueId = state.preselectedDeck![0];
    const clue = getClueById(clueId);
    if (!clue.paramKind) {
      expect(next.pendingGuess).toBeNull();
      expect(next.guesses.length).toBe(1);
      expect(next.guesses[0].clueId).toBe(clueId);
      expect(next.guesses[0].result).toBeDefined();
    } else {
      // paramKind clue → reducer parks pendingGuess.
      expect(next.pendingGuess).not.toBeNull();
      expect(next.guesses.length).toBe(0);
    }
  });

  it("blocks REDRAW in preselected mode", () => {
    const target = "12345";
    let state = initGameState({
      target,
      seed: "preselect-redraw",
      maxGuesses: 7,
      preselectedClues: true,
    });
    state = reduce(state, { type: "SUBMIT_GUESS", guess: "98765" });
    const before = state;
    const after = reduce(before, { type: "REDRAW" });
    expect(after).toBe(before); // no-op (REDRAW blocked)
  });

  it("preselectedDeck is null in non-preselected mode", () => {
    const state = initGameState({
      target: "12345",
      seed: "vanilla",
      maxGuesses: 7,
      preselectedClues: false,
    });
    expect(state.preselectedDeck).toBeNull();
  });
});
