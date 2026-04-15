import { describe, it, expect } from "vitest";
import { pickTwoClues } from "@/lib/game/clueSelector";
import type { ClueId } from "@/lib/game/clues/types";

describe("pickTwoClues", () => {
  it("returns two distinct clues", () => {
    const [a, b] = pickTwoClues("2026-04-14", []);
    expect(a.id).not.toBe(b.id);
  });
  it("is deterministic for the same (seed, chosen path)", () => {
    const a = pickTwoClues("2026-04-14", ["bullseyes", "oracle"]);
    const b = pickTwoClues("2026-04-14", ["bullseyes", "oracle"]);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
  it("differs across different chosen paths", () => {
    const a = pickTwoClues("2026-04-14", ["bullseyes"]);
    const b = pickTwoClues("2026-04-14", ["oracle"]);
    expect(a.map((c) => c.id).sort()).not.toEqual(b.map((c) => c.id).sort());
  });
  it("same CHOSEN SET via different paths yields the same next pair", () => {
    // Two players who arrived at {bullseyes, oracle} via opposite orders
    // have identical knowledge — they should see the same next options.
    const a = pickTwoClues("2026-04-14", ["bullseyes", "oracle"]);
    const b = pickTwoClues("2026-04-14", ["oracle", "bullseyes"]);
    expect(a.map((c) => c.id).sort()).toEqual(b.map((c) => c.id).sort());
  });
  it("never re-offers an already-chosen clue", () => {
    const chosen: ClueId[] = [];
    // Walk through 7 guesses picking the first option each time; no id should repeat.
    for (let g = 0; g < 7; g++) {
      const [opt] = pickTwoClues("path-test", chosen);
      expect(chosen.includes(opt.id)).toBe(false);
      chosen.push(opt.id);
    }
    expect(new Set(chosen).size).toBe(chosen.length);
  });
  it("distribution roughly honors weights across fresh draws", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) {
      for (const c of pickTwoClues(`bench-${i}`, [])) {
        counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
      }
    }
    for (const [, n] of counts) expect(n).toBeGreaterThan(300);
  });
});
