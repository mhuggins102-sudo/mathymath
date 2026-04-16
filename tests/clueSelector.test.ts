import { describe, it, expect } from "vitest";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { getClueById } from "@/lib/game/clues/registry";
import type { ClueId } from "@/lib/game/clues/types";

describe("pickTwoClues (deck_1p1c scheme)", () => {
  it("returns two distinct clues", () => {
    const [a, b] = pickTwoClues("2026-04-14", []);
    expect(a.id).not.toBe(b.id);
  });

  it("is deterministic for the same (seed, round)", () => {
    const a = pickTwoClues("2026-04-14", ["bullseyes", "oracle"]);
    const b = pickTwoClues("2026-04-14", ["bullseyes", "oracle"]);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("pair 1 is always exactly 1 positional + 1 non-positional (across many seeds)", () => {
    for (let i = 0; i < 200; i++) {
      const [a, b] = pickTwoClues(`seed-${i}`, []);
      const positionals = [a, b].filter(
        (c) => c.category === "positional",
      ).length;
      expect(positionals).toBe(1);
    }
  });

  it("round index is driven by chosenClueIds.length, not its content", () => {
    // Two callers at the same round (length 1) with different content
    // see the SAME pair — in the deck model the pair at position 2-3 is
    // deterministic from the seed, independent of which specific clue
    // was chosen at round 0.
    const a = pickTwoClues("2026-04-14", ["bullseyes"]);
    const b = pickTwoClues("2026-04-14", ["oracle"]);
    expect(a.map((c) => c.id).sort()).toEqual(b.map((c) => c.id).sort());
  });

  it("never offers a clue that already appeared in an earlier pair (poof discard)", () => {
    // Walk the deck: draw a pair per round, pick either option, assert
    // the card id has not appeared before (in either pair slot).
    const seenIds = new Set<ClueId>();
    const chosen: ClueId[] = [];
    for (let round = 0; round < 6; round++) {
      const [a, b] = pickTwoClues("poof-test", chosen);
      expect(seenIds.has(a.id)).toBe(false);
      expect(seenIds.has(b.id)).toBe(false);
      seenIds.add(a.id);
      seenIds.add(b.id);
      chosen.push(a.id);
    }
  });

  it("clue appearance spreads across the roster over many seeds", () => {
    // Over 10k seeds, every clue should appear at least some of the time.
    // The deck_1p1c scheme drops weights, so we just sanity-check that
    // no clue is starved. 10k seeds × 2 cards drawn in pair 1 = 20k
    // slots; with 17 clues, uniform would give ~1176 per clue. Set a
    // conservative floor of 200 so CI noise can't flake this.
    const counts = new Map<ClueId, number>();
    for (let i = 0; i < 10_000; i++) {
      for (const c of pickTwoClues(`bench-${i}`, [])) {
        counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
      }
    }
    for (const [, n] of counts) expect(n).toBeGreaterThan(200);
  });

  it("all 17 clues are reachable through the deck (no clue is structurally excluded)", () => {
    // For each seed, drawing all ~8 possible rounds will visit at least
    // 14 cards (2 × 7 = 14, out of 17 total). Over enough seeds every
    // clue id should appear at least once. Acts as a smoke test that
    // neither deck shuffle accidentally filters a clue out.
    const seen = new Set<ClueId>();
    for (let i = 0; i < 100 && seen.size < 17; i++) {
      for (let round = 0; round < 8; round++) {
        const chosen = Array.from({ length: round }, () => "bullseyes" as ClueId);
        const [a, b] = pickTwoClues(`reach-${i}`, chosen);
        seen.add(a.id);
        seen.add(b.id);
      }
    }
    // Sanity: every clue in the registry should be visited.
    for (const c of [
      "bullseyes",
      "higherLower",
      "within2",
      "parityMask",
      "oracle",
      "thermometer",
      "sumDelta",
      "digitOverlap",
      "parityBalance",
      "primeCount",
      "rangeCompare",
      "containsDigit",
      "distinctDigits",
      "median",
      "divisibleBy",
      "totalDeviation",
      "extraLock",
    ] as ClueId[]) {
      // getClueById sanity + seen
      expect(getClueById(c).id).toBe(c);
      expect(seen.has(c)).toBe(true);
    }
  });
});
