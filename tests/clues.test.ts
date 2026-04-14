import { describe, it, expect } from "vitest";
import { bullseyesClue } from "@/lib/game/clues/bullseyes";
import { higherLowerClue } from "@/lib/game/clues/higherLower";
import { within2Clue } from "@/lib/game/clues/within2";
import { parityMaskClue } from "@/lib/game/clues/parityMask";
import { oracleClue } from "@/lib/game/clues/oracle";
import { thermometerClue } from "@/lib/game/clues/thermometer";
import { sumDirectionClue } from "@/lib/game/clues/sumDirection";
import { sumDeltaClue } from "@/lib/game/clues/sumDelta";
import { digitOverlapClue } from "@/lib/game/clues/digitOverlap";
import { parityBalanceClue } from "@/lib/game/clues/parityBalance";
import { primeCountClue } from "@/lib/game/clues/primeCount";
import { rangeCompareClue } from "@/lib/game/clues/rangeCompare";
import { containsDigitClue } from "@/lib/game/clues/containsDigit";
import { distinctDigitsClue } from "@/lib/game/clues/distinctDigits";
import { maxDigitClue } from "@/lib/game/clues/maxDigit";
import { CLUES, getClueById } from "@/lib/game/clues/registry";

describe("Bullseyes", () => {
  it("marks exact slot matches", () => {
    expect(bullseyesClue.compute("12345", "10305").hits).toEqual([
      true, false, true, false, true,
    ]);
  });
});

describe("Higher or Lower", () => {
  it("reports cmp per slot (target vs guess)", () => {
    // guess=50555, target=12598
    // slot 0: target 1 < guess 5 -> lt
    // slot 1: target 2 > guess 0 -> gt
    // slot 2: target 5 = guess 5 -> eq
    // slot 3: target 9 > guess 5 -> gt
    // slot 4: target 8 > guess 5 -> gt
    expect(higherLowerClue.compute("50555", "12598").cmp).toEqual([
      "lt", "gt", "eq", "gt", "gt",
    ]);
  });
});

describe("Within 2", () => {
  it("marks slots within ±2", () => {
    expect(within2Clue.compute("13579", "15670").mask).toEqual([
      true, true, true, true, false,
    ]);
  });
});

describe("Parity Mask", () => {
  it("matches per-slot parity", () => {
    // guess 13579 vs target 02468: each slot odd-vs-even -> all mismatched
    expect(parityMaskClue.compute("13579", "02468").matches).toEqual([
      false, false, false, false, false,
    ]);
    // guess 13579 vs target 97531: all odd-odd -> all matched
    expect(parityMaskClue.compute("13579", "97531").matches).toEqual([
      true, true, true, true, true,
    ]);
  });
});

describe("Oracle", () => {
  it("returns a valid slot and the true digit there", () => {
    const target = "74827";
    const r = oracleClue.compute("00000", target);
    expect(r.slot).toBeGreaterThanOrEqual(0);
    expect(r.slot).toBeLessThan(target.length);
    expect(r.digit).toBe(Number(target[r.slot]));
  });
  it("is deterministic per (guess, target)", () => {
    const a = oracleClue.compute("12345", "74827");
    const b = oracleClue.compute("12345", "74827");
    expect(a).toEqual(b);
  });
});

describe("Thermometer", () => {
  it("tiers distances", () => {
    // |1-1|=0 -> 0
    // |3-6|=3 -> 2 (within 3)
    // |5-8|=3 -> 2 (within 3)
    // |7-2|=5 -> 3 (within 5)
    // |9-0|=9 -> 4 (far)
    expect(thermometerClue.compute("13579", "16820").tier).toEqual([
      0, 2, 2, 3, 4,
    ]);
  });
});

describe("Sum Direction + Sum Delta", () => {
  it("agrees on sign", () => {
    const g = "12000";
    const t = "33333";
    expect(sumDeltaClue.compute(g, t).delta).toBe(15 - 3);
    expect(sumDirectionClue.compute(g, t).cmp).toBe("gt");
  });
  it("equal is eq", () => {
    expect(sumDirectionClue.compute("12345", "54321").cmp).toBe("eq");
    expect(sumDeltaClue.compute("12345", "54321").delta).toBe(0);
  });
});

describe("Digit Overlap", () => {
  it("multiset intersection", () => {
    // target counts: {7:3,4:1,2:1}; guess counts: {7:4,2:1}
    expect(digitOverlapClue.compute("77772", "74727").count).toBe(4);
  });
  it("disjoint is 0", () => {
    expect(digitOverlapClue.compute("11111", "22222").count).toBe(0);
  });
});

describe("Parity Balance", () => {
  it("matches count of evens", () => {
    // target 02468 -> 5 evens; guess 24680 -> 5 evens
    expect(parityBalanceClue.compute("24680", "02468").match).toBe(true);
    // target 12345 -> 2 evens; guess 11111 -> 0 evens
    expect(parityBalanceClue.compute("11111", "12345").match).toBe(false);
  });
});

describe("Prime Count", () => {
  it("counts digits in {2,3,5,7}", () => {
    // target 23579 -> 4 primes; guess 12345 -> 3 primes (2,3,5)
    expect(primeCountClue.compute("12345", "23579").match).toBe(false);
    // target 23570 (4 primes); guess 23579 (4 primes)
    expect(primeCountClue.compute("23570", "23579").match).toBe(true);
  });
});

describe("Contains Digit", () => {
  it("deterministic per (guess, target)", () => {
    const a = containsDigitClue.compute("12345", "67890");
    const b = containsDigitClue.compute("12345", "67890");
    expect(a).toEqual(b);
    expect(a.digit).toBeGreaterThanOrEqual(0);
    expect(a.digit).toBeLessThan(10);
  });
  it("present=true when the seeded digit appears in target", () => {
    // Use a target where ALL digits are the same so any seeded digit lookup is trivial.
    const r = containsDigitClue.compute("12345", "77777");
    expect(r.present).toBe(r.digit === 7);
  });
});

describe("Distinct Digits", () => {
  it("counts unique digits", () => {
    expect(distinctDigitsClue.compute("00000", "77727").count).toBe(2);
    expect(distinctDigitsClue.compute("00000", "12345").count).toBe(5);
    expect(distinctDigitsClue.compute("00000", "11111").count).toBe(1);
  });
});

describe("Max Digit", () => {
  it("compares maxes", () => {
    // guess max 9 vs target max 5 -> lt
    expect(maxDigitClue.compute("19000", "12345").cmp).toBe("lt");
    // guess max 5 vs target max 9 -> gt
    expect(maxDigitClue.compute("12345", "90000").cmp).toBe("gt");
    // equal maxes -> eq
    expect(maxDigitClue.compute("12345", "54321").cmp).toBe("eq");
  });
});

describe("Range Compare", () => {
  it("compares whole numbers", () => {
    expect(rangeCompareClue.compute("01234", "99999").cmp).toBe("gt");
    expect(rangeCompareClue.compute("99999", "00001").cmp).toBe("lt");
    expect(rangeCompareClue.compute("12345", "12345").cmp).toBe("eq");
  });
});

describe("Registry", () => {
  it("has 15 clues, each weight > 0 and distinct id", () => {
    expect(CLUES).toHaveLength(15);
    const ids = new Set(CLUES.map((c) => c.id));
    expect(ids.size).toBe(15);
    for (const c of CLUES) {
      expect(c.weight).toBeGreaterThan(0);
    }
  });
  it("lookup by id works for every clue", () => {
    for (const c of CLUES) {
      expect(getClueById(c.id)).toBe(c);
    }
  });
});
