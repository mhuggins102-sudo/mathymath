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

  it("loses after maxGuesses wrong guesses", () => {
    let s = initGameState({ target: "12345", seed: "t", maxGuesses: 2 });
    for (let i = 0; i < 2; i++) {
      s = reduce(s, { type: "SUBMIT_GUESS", guess: "99999" });
      const opt = s.pendingGuess!.options[0];
      s = reduce(s, { type: "CHOOSE_CLUE", clueId: opt.id });
    }
    expect(s.status).toBe("lost");
  });

  it("ignores SUBMIT_GUESS while pending", () => {
    let s = initGameState({ target: "12345", seed: "t" });
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "11111" });
    const before = s;
    s = reduce(s, { type: "SUBMIT_GUESS", guess: "22222" });
    expect(s).toBe(before);
  });
});
