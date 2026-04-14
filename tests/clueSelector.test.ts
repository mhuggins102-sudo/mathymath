import { describe, it, expect } from "vitest";
import { pickTwoClues } from "@/lib/game/clueSelector";

describe("pickTwoClues", () => {
  it("returns two distinct clues", () => {
    for (let i = 0; i < 8; i++) {
      const [a, b] = pickTwoClues("2026-04-14", i);
      expect(a.id).not.toBe(b.id);
    }
  });
  it("is deterministic for the same (seed, index)", () => {
    const a = pickTwoClues("2026-04-14", 3);
    const b = pickTwoClues("2026-04-14", 3);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
  it("differs across indices (most of the time)", () => {
    const pairs = Array.from({ length: 8 }, (_, i) =>
      pickTwoClues("2026-04-14", i).map((c) => c.id).sort().join(","),
    );
    const unique = new Set(pairs);
    expect(unique.size).toBeGreaterThan(1);
  });
  it("distribution roughly honors weights", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) {
      for (const c of pickTwoClues("bench", i)) {
        counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
      }
    }
    // Every clue should appear at least a few hundred times in 20k draws.
    for (const [, n] of counts) expect(n).toBeGreaterThan(300);
  });
});
