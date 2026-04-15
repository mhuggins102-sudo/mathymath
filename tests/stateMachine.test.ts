import { describe, it, expect } from "vitest";
import { initGameState, reduce } from "@/lib/game/stateMachine";

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
});
