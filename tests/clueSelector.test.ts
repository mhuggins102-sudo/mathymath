import { describe, it, expect } from "vitest";
import {
  ROUND1_CURATED_CLUE_IDS,
  isPositionalClueId,
  pickTwoClues,
} from "@/lib/game/clueSelector";
import { getClueById } from "@/lib/game/clues/registry";
import type { ClueId } from "@/lib/game/clues/types";

describe("pickTwoClues — basics", () => {
  it("returns two distinct clues", () => {
    const [a, b] = pickTwoClues("2026-04-14", []);
    expect(a.id).not.toBe(b.id);
  });

  it("is deterministic for the same (seed, round)", () => {
    const a = pickTwoClues("2026-04-14", ["bullseyes", "oracle"]);
    const b = pickTwoClues("2026-04-14", ["bullseyes", "oracle"]);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("round index is driven by chosenClueIds.length, not its content", () => {
    const a = pickTwoClues("2026-04-14", ["bullseyes"]);
    const b = pickTwoClues("2026-04-14", ["oracle"]);
    expect(a.map((c) => c.id).sort()).toEqual(b.map((c) => c.id).sort());
  });

  it("never offers a clue that already appeared in an earlier pair", () => {
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
    const counts = new Map<ClueId, number>();
    for (let i = 0; i < 10_000; i++) {
      for (const c of pickTwoClues(`bench-${i}`, [])) {
        counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
      }
    }
    for (const [, n] of counts) expect(n).toBeGreaterThan(200);
  });

  it("every registered info clue is reachable through the deck", () => {
    const seen = new Set<ClueId>();
    for (let i = 0; i < 2000 && seen.size < 22; i++) {
      for (let round = 0; round < 11; round++) {
        const chosen = Array.from({ length: round }, () => "bullseyes" as ClueId);
        const [a, b] = pickTwoClues(`reach-${i}`, chosen);
        seen.add(a.id);
        seen.add(b.id);
      }
    }
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
      "diceCount",
      "upsAndDowns",
      "bullseyeTrend",
      "elimination",
      "extraLock",
      "clueReuse",
    ] as ClueId[]) {
      expect(getClueById(c).id).toBe(c);
      expect(seen.has(c)).toBe(true);
    }
  });
});

describe("isPositionalClueId", () => {
  it("returns true for positional clue ids", () => {
    for (const id of [
      "bullseyes",
      "higherLower",
      "within2",
      "parityMask",
      "oracle",
      "thermometer",
    ] as const) {
      expect(isPositionalClueId(id)).toBe(true);
    }
  });
  it("returns false for non-positional, special, and unknown ids", () => {
    expect(isPositionalClueId("sumDelta")).toBe(false);
    expect(isPositionalClueId("clueReuse")).toBe(false);
    expect(isPositionalClueId("extraLock")).toBe(false);
    expect(isPositionalClueId(undefined)).toBe(false);
    expect(isPositionalClueId("madeUp")).toBe(false);
  });
});

describe("pickTwoClues — regular mode pair-1 curated guarantee", () => {
  it("ROUND1_CURATED_CLUE_IDS contains the user-specified set", () => {
    expect([...ROUND1_CURATED_CLUE_IDS].sort()).toEqual(
      [
        "digitOverlap",
        "elimination",
        "divisibleBy",
        "containsDigit",
        "higherLower",
        "within2",
        "oracle",
        "thermometer",
      ].sort(),
    );
  });

  it("pair 1 always contains at least one curated clue (across many seeds)", () => {
    for (let i = 0; i < 500; i++) {
      const [a, b] = pickTwoClues(`curated-${i}`, []);
      const hasCurated =
        ROUND1_CURATED_CLUE_IDS.has(a.id) || ROUND1_CURATED_CLUE_IDS.has(b.id);
      expect(hasCurated).toBe(true);
    }
  });

  it("pair 1 covers a variety of curated cards (not just one)", () => {
    // Confirm the curated guarantee doesn't degenerate into always
    // showing the same card. Across many seeds, every curated id should
    // appear at least once in pair 1.
    const seenCurated = new Set<ClueId>();
    for (let i = 0; i < 5_000 && seenCurated.size < ROUND1_CURATED_CLUE_IDS.size; i++) {
      const [a, b] = pickTwoClues(`spread-${i}`, []);
      if (ROUND1_CURATED_CLUE_IDS.has(a.id)) seenCurated.add(a.id);
      if (ROUND1_CURATED_CLUE_IDS.has(b.id)) seenCurated.add(b.id);
    }
    expect(seenCurated.size).toBe(ROUND1_CURATED_CLUE_IDS.size);
  });

  it("never offers Clue Reuse on round 1 even after redraws", () => {
    for (let s = 0; s < 200; s++) {
      const seed = `r1-noreuse-${s}`;
      for (let off = 0; off < 6; off++) {
        const [a, b] = pickTwoClues(seed, [], off);
        expect(a.id).not.toBe("clueReuse");
        expect(b.id).not.toBe("clueReuse");
      }
    }
  });

  it("never offers Bullseye Trend on round 1 even after redraws", () => {
    for (let s = 0; s < 200; s++) {
      const seed = `r1-no-trend-${s}`;
      for (let off = 0; off < 6; off++) {
        const [a, b] = pickTwoClues(seed, [], off);
        expect(a.id).not.toBe("bullseyeTrend");
        expect(b.id).not.toBe("bullseyeTrend");
      }
    }
  });

  it("CAN offer Bullseye Trend from round 2 onward", () => {
    let seen = false;
    for (let s = 0; s < 1000 && !seen; s++) {
      const seed = `r2-trend-${s}`;
      for (let off = 0; off < 5; off++) {
        const [a, b] = pickTwoClues(seed, ["sumDelta"], off);
        if (a.id === "bullseyeTrend" || b.id === "bullseyeTrend") {
          seen = true;
          break;
        }
      }
    }
    expect(seen).toBe(true);
  });

  it("CAN offer Clue Reuse from round 2 onward in regular mode", () => {
    let seen = false;
    for (let s = 0; s < 1000 && !seen; s++) {
      const seed = `r2-reuse-${s}`;
      for (let off = 0; off < 5; off++) {
        const [a, b] = pickTwoClues(seed, ["sumDelta"], off);
        if (a.id === "clueReuse" || b.id === "clueReuse") {
          seen = true;
          break;
        }
      }
    }
    expect(seen).toBe(true);
  });
});

describe("pickTwoClues — advanced mode (full shuffle, no Clue Reuse)", () => {
  it("never offers Clue Reuse anywhere in advanced mode", () => {
    // Walk many seeds × rounds and assert Clue Reuse is structurally
    // excluded from the advanced deck (the user removed it because
    // advanced players start with 0 locks and would have nothing to
    // spend on it).
    for (let s = 0; s < 200; s++) {
      const seed = `adv-no-reuse-${s}`;
      const chosen: ClueId[] = [];
      for (let round = 0; round < 7; round++) {
        const [a, b] = pickTwoClues(seed, chosen, 0, true);
        expect(a.id).not.toBe("clueReuse");
        expect(b.id).not.toBe("clueReuse");
        chosen.push(a.id);
      }
    }
  });

  it("never offers Bullseye Trend on round 1 in advanced mode", () => {
    for (let s = 0; s < 200; s++) {
      const seed = `adv-no-trend-r1-${s}`;
      for (let off = 0; off < 6; off++) {
        const [a, b] = pickTwoClues(seed, [], off, true);
        expect(a.id).not.toBe("bullseyeTrend");
        expect(b.id).not.toBe("bullseyeTrend");
      }
    }
  });

  it("returns two distinct clues even in advanced mode", () => {
    for (let i = 0; i < 200; i++) {
      const [a, b] = pickTwoClues(`adv-distinct-${i}`, [], 0, true);
      expect(a.id).not.toBe(b.id);
    }
  });

  it("is deterministic across calls for the same seed in advanced mode", () => {
    const a = pickTwoClues("seedX", ["sumDelta"], 0, true);
    const b = pickTwoClues("seedX", ["sumDelta"], 0, true);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("regular and advanced modes produce different decks at the same seed", () => {
    let diverged = 0;
    for (let i = 0; i < 50; i++) {
      const seed = `cmp-${i}`;
      let chosen: ClueId[] = [];
      let differs = false;
      for (let r = 0; r < 6; r++) {
        const std = pickTwoClues(seed, chosen, 0, false);
        const adv = pickTwoClues(seed, chosen, 0, true);
        const stdIds = std.map((c) => c.id).sort().join(",");
        const advIds = adv.map((c) => c.id).sort().join(",");
        if (stdIds !== advIds) {
          differs = true;
          break;
        }
        chosen = [...chosen, std[0].id];
      }
      if (differs) diverged++;
    }
    expect(diverged).toBe(50);
  });

  it("advanced mode does NOT enforce a curated pair-1 guarantee", () => {
    // The curated guarantee is regular-mode only. In advanced mode the
    // pair-1 distribution is closer to uniform across the (non-Clue-
    // Reuse, pair-1-eligible) roster, so a meaningful share of seeds
    // produce pairs entirely outside the curated set.
    let allNonCurated = 0;
    for (let i = 0; i < 1000; i++) {
      const [a, b] = pickTwoClues(`adv-nocurated-${i}`, [], 0, true);
      const onlyNonCurated =
        !ROUND1_CURATED_CLUE_IDS.has(a.id) &&
        !ROUND1_CURATED_CLUE_IDS.has(b.id);
      if (onlyNonCurated) allNonCurated++;
    }
    // 8 of ~21 pair-1-eligible cards are curated → P(both non-curated)
    // ≈ (13/21)*(12/20) ≈ 37%. Floor of 100/1000 (10%) leaves ample
    // headroom over CI noise.
    expect(allNonCurated).toBeGreaterThan(100);
  });
});

describe("pickTwoClues — excludeIds soft filter", () => {
  it("never offers a clue in excludeIds when the eligible pool has alternatives", () => {
    for (let s = 0; s < 200; s++) {
      const seed = `excl-${s}`;
      const offered = new Set<ClueId>();
      const chosen: ClueId[] = [];
      for (let round = 0; round < 7; round++) {
        const pair = pickTwoClues(seed, chosen, 0, true, offered);
        expect(offered.has(pair[0].id)).toBe(false);
        expect(offered.has(pair[1].id)).toBe(false);
        offered.add(pair[0].id);
        offered.add(pair[1].id);
        chosen.push(pair[0].id);
      }
    }
  });

  it("falls back to a duplicate only when no fresh eligible card exists", () => {
    // Synthesize an exclude set that covers nearly every clue. The
    // function still has to return a pair — we just need it to not
    // throw. Empty-eligible-pool fallback path is exercised here.
    const everyId = [
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
      "diceCount",
      "upsAndDowns",
      "extraLock",
      "elimination",
      "bullseyes",
      "higherLower",
      "within2",
      "parityMask",
      "oracle",
      "thermometer",
    ] as ClueId[];
    const [a, b] = pickTwoClues(
      "fallback-seed",
      [],
      0,
      true,
      new Set(everyId),
    );
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  it("default empty excludeIds preserves prior behavior (regression guard)", () => {
    for (let s = 0; s < 50; s++) {
      const seed = `default-excl-${s}`;
      const a = pickTwoClues(seed, [], 0, false);
      const b = pickTwoClues(seed, [], 0, false, new Set());
      expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    }
  });
});
