import { describe, it, expect } from "vitest";
import { bullseyesClue } from "@/lib/game/clues/bullseyes";
import { higherLowerClue } from "@/lib/game/clues/higherLower";
import { within2Clue } from "@/lib/game/clues/within2";
import { parityMaskClue } from "@/lib/game/clues/parityMask";
import { oracleClue } from "@/lib/game/clues/oracle";
import { thermometerClue } from "@/lib/game/clues/thermometer";
import { sumDeltaClue } from "@/lib/game/clues/sumDelta";
import { digitOverlapClue } from "@/lib/game/clues/digitOverlap";
import { parityBalanceClue } from "@/lib/game/clues/parityBalance";
import { primeCountClue } from "@/lib/game/clues/primeCount";
import { rangeCompareClue } from "@/lib/game/clues/rangeCompare";
import { containsDigitClue } from "@/lib/game/clues/containsDigit";
import { distinctDigitsClue } from "@/lib/game/clues/distinctDigits";
import { medianClue } from "@/lib/game/clues/median";
import { divisibleByClue } from "@/lib/game/clues/divisibleBy";
import { totalDeviationClue } from "@/lib/game/clues/totalDeviation";
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
  it("skips slots the player already knows (context.knownSlots)", () => {
    const target = "74827";
    // Pick a (guess,target) the plain call would map to some slot S.
    const plain = oracleClue.compute("12345", target);
    // Now pass that slot as already known. Oracle must pick a DIFFERENT
    // slot — never re-reveal.
    const withKnown = oracleClue.compute("12345", target, {
      knownSlots: [plain.slot],
    });
    expect(withKnown.slot).not.toBe(plain.slot);
    expect(withKnown.digit).toBe(Number(target[withKnown.slot]));
  });
  it("is deterministic per (guess, target, knownSlots)", () => {
    const target = "74827";
    const a = oracleClue.compute("12345", target, { knownSlots: [0, 2] });
    const b = oracleClue.compute("12345", target, { knownSlots: [0, 2] });
    expect(a).toEqual(b);
    // Different known-set → potentially different slot.
    const c = oracleClue.compute("12345", target, { knownSlots: [1, 3] });
    // They MAY coincide by luck, but the determinism property still
    // says each call is stable with its own knownSlots.
    expect(c).toEqual(
      oracleClue.compute("12345", target, { knownSlots: [1, 3] }),
    );
  });
  it("falls back to the full pool if every slot is somehow already known", () => {
    const target = "74827";
    const r = oracleClue.compute("12345", target, {
      knownSlots: [0, 1, 2, 3, 4],
    });
    // Just has to return SOMETHING valid rather than crash.
    expect(r.slot).toBeGreaterThanOrEqual(0);
    expect(r.slot).toBeLessThan(target.length);
    expect(r.digit).toBe(Number(target[r.slot]));
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

describe("Sum Delta", () => {
  it("reports signed digit-sum delta (target - guess)", () => {
    const g = "12000";
    const t = "33333";
    expect(sumDeltaClue.compute(g, t).delta).toBe(15 - 3);
  });
  it("equal is 0", () => {
    expect(sumDeltaClue.compute("12345", "54321").delta).toBe(0);
  });
});

describe("Digit Overlap", () => {
  it("is a multiset intersection (caps repeats at the target's count)", () => {
    // guess 22245 vs target 57221: target has two 2s, so the three 2s in
    // the guess claim only 2. Plus the single 5. Total: 3.
    expect(digitOverlapClue.compute("22245", "57221").count).toBe(3);
  });
  it("counts each distinct match when target holds all copies", () => {
    // guess 23446 vs target 44215: target {4:2, 2:1, 1:1, 5:1};
    //   one 2 matches, two 4s match → 3.
    expect(digitOverlapClue.compute("23446", "44215").count).toBe(3);
  });
  it("excess repeats in the guess don't count", () => {
    // guess 11111 vs target 10234: target has only one 1, so only one
    // of the guess's five 1s can claim it.
    expect(digitOverlapClue.compute("11111", "10234").count).toBe(1);
  });
  it("disjoint is 0", () => {
    expect(digitOverlapClue.compute("11111", "22222").count).toBe(0);
  });
});

describe("Parity Balance", () => {
  it("compares even-digit counts", () => {
    // target 02468 -> 5 evens; guess 24680 -> 5 evens => eq
    expect(parityBalanceClue.compute("24680", "02468").cmp).toBe("eq");
    // target 12345 -> 2 evens; guess 11111 -> 0 evens => target has more => gt
    expect(parityBalanceClue.compute("11111", "12345").cmp).toBe("gt");
    // target 11111 (0); guess 24680 (5) => lt
    expect(parityBalanceClue.compute("24680", "11111").cmp).toBe("lt");
  });
});

describe("Prime Count", () => {
  it("compares prime-digit counts", () => {
    // target 23579 -> 4 primes; guess 12345 -> 3 primes (2,3,5) => target has more => gt
    expect(primeCountClue.compute("12345", "23579").cmp).toBe("gt");
    // target 23570 (4 primes); guess 23579 (4 primes) => eq
    expect(primeCountClue.compute("23570", "23579").cmp).toBe("eq");
    // target 11111 (0); guess 22222 (5) => lt
    expect(primeCountClue.compute("22222", "11111").cmp).toBe("lt");
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

describe("Digit Range (rangeCompare)", () => {
  it("compares the spread (max-min) of digits", () => {
    // guess 12532 range = 5-1 = 4; target 51903 range = 9-0 = 9 => target ↑
    expect(rangeCompareClue.compute("12532", "51903").cmp).toBe("gt");
    // both equal range
    expect(rangeCompareClue.compute("12345", "56789").cmp).toBe("eq");
    // guess wider than target
    expect(rangeCompareClue.compute("19000", "12345").cmp).toBe("lt");
  });
});

describe("Median", () => {
  it("compares the sorted-middle digit", () => {
    // guess 12345 median=3; target 54321 median=3 => eq
    expect(medianClue.compute("12345", "54321").cmp).toBe("eq");
    // guess 11111 median=1; target 99999 median=9 => target ↑
    expect(medianClue.compute("11111", "99999").cmp).toBe("gt");
    // guess 99999; target 11111 => target ↓
    expect(medianClue.compute("99999", "11111").cmp).toBe("lt");
  });
});

describe("Divisible By", () => {
  it("picks a divisor in 2-9 that divides the target", () => {
    // 12345 is divisible by 3 and 5 and 15. Valid divisors 2-9: 3, 5.
    const r = divisibleByClue.compute("00000", "12345");
    expect(r.present).toBe(true);
    expect([3, 5]).toContain(r.divisor);
  });
  it("reports 'no' when no value 2-9 divides", () => {
    // 11 is prime, only divisor 2-9 divides nothing. But target needs to be 5 digits.
    // 10007 is prime. 10007 % 2-9: none divide (it's prime).
    const r = divisibleByClue.compute("00000", "10007");
    expect(r.present).toBe(false);
    expect(r.divisor).toBe(null);
  });
  it("is deterministic per (guess, target)", () => {
    const a = divisibleByClue.compute("12345", "67890");
    const b = divisibleByClue.compute("12345", "67890");
    expect(a).toEqual(b);
  });
});

describe("Total Deviation", () => {
  it("sums per-slot absolute differences", () => {
    expect(totalDeviationClue.compute("55555", "10994").value).toBe(18);
  });
  it("is 0 when every slot is exact", () => {
    expect(totalDeviationClue.compute("47628", "47628").value).toBe(0);
  });
  it("maxes at 45 when every digit is maximally off", () => {
    expect(totalDeviationClue.compute("00000", "99999").value).toBe(45);
    expect(totalDeviationClue.compute("99999", "00000").value).toBe(45);
  });
});

describe("Registry", () => {
  it("has 16 clues, each weight > 0 and distinct id", () => {
    expect(CLUES).toHaveLength(16);
    const ids = new Set(CLUES.map((c) => c.id));
    expect(ids.size).toBe(16);
    for (const c of CLUES) {
      expect(c.weight).toBeGreaterThan(0);
    }
  });
  it("lookup by id works for every clue", () => {
    for (const c of CLUES) {
      expect(getClueById(c.id)).toBe(c);
    }
  });
  it("retired clues are gone", () => {
    const ids = new Set(CLUES.map((c) => c.id));
    for (const retired of ["sumDirection", "maxDigit"]) {
      expect(ids.has(retired as never)).toBe(false);
    }
  });
});
