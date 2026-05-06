import { describe, it, expect } from "vitest";
import { buildPreselectedDeck } from "@/lib/game/clueSelector";
import { initGameState, reduce } from "@/lib/game/stateMachine";
import { getClueById } from "@/lib/game/clues/registry";
import { POSITIONAL_CLUE_IDS } from "@/lib/game/clueSelector";

describe("buildPreselectedDeck", () => {
  it("standard mode: slot 0 is positional, deck has 6 distinct clues", () => {
    const deck = buildPreselectedDeck("seed-A", 6, false);
    expect(deck.length).toBe(6);
    expect(POSITIONAL_CLUE_IDS.has(deck[0])).toBe(true);
    expect(new Set(deck).size).toBe(6);
    // No special clues should appear.
    for (const id of deck) {
      expect(getClueById(id).category).not.toBe("special");
    }
  });

  it("standard mode: deterministic for the same seed", () => {
    const a = buildPreselectedDeck("seed-B", 6, false);
    const b = buildPreselectedDeck("seed-B", 6, false);
    expect(a).toEqual(b);
  });

  it("advanced mode: at most 2 positional, 6 distinct, no special", () => {
    // Spot-check several seeds since advanced shuffles freely; the
    // cap should hold for every seed.
    for (let i = 0; i < 50; i++) {
      const deck = buildPreselectedDeck(`adv-${i}`, 6, true);
      expect(deck.length).toBe(6);
      expect(new Set(deck).size).toBe(6);
      const positionalCount = deck.filter((id) =>
        POSITIONAL_CLUE_IDS.has(id),
      ).length;
      expect(positionalCount).toBeLessThanOrEqual(2);
      for (const id of deck) {
        expect(getClueById(id).category).not.toBe("special");
      }
    }
  });

  it("advanced mode: positional may land at any index (not always slot 0)", () => {
    // Across many seeds, at least once we should see a non-positional
    // clue at slot 0 (otherwise advanced mode is leaking the
    // standard-mode guarantee).
    let sawNonPositionalAt0 = false;
    for (let i = 0; i < 200; i++) {
      const deck = buildPreselectedDeck(`adv-pos0-${i}`, 6, true);
      if (!POSITIONAL_CLUE_IDS.has(deck[0])) {
        sawNonPositionalAt0 = true;
        break;
      }
    }
    expect(sawNonPositionalAt0).toBe(true);
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
