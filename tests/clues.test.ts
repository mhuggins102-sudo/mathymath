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
import { diceCountClue } from "@/lib/game/clues/diceCount";
import {
  directionRuns,
  upsAndDownsClue,
} from "@/lib/game/clues/upsAndDowns";
import { extraLockClue } from "@/lib/game/clues/extraLock";
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
    const r = within2Clue.compute("13579", "15670");
    expect(r.mask).toEqual([true, true, true, true, false]);
  });
  it("flags exact matches separately from close-but-not-exact", () => {
    // guess=15370 vs target=15670: slot 0 exact, slot 1 exact, slot 2
    // off by 3 (not within 2), slot 3 exact, slot 4 exact.
    const r = within2Clue.compute("15370", "15670");
    expect(r.exact).toEqual([true, true, false, true, true]);
    expect(r.mask).toEqual([true, true, false, true, true]);
  });
  it("exact is false when diff is 1 or 2 (close but not exact)", () => {
    // guess=12345 vs target=13355 diffs: |1-1|=0, |2-3|=1, |3-3|=0,
    //   |4-5|=1, |5-5|=0 → exact at slots 0,2,4.
    const r = within2Clue.compute("12345", "13355");
    expect(r.exact).toEqual([true, false, true, false, true]);
    expect(r.mask).toEqual([true, true, true, true, true]);
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
  it("tiers distances into 4 buckets (exact / 1-2 / 3-4 / 5+)", () => {
    // |1-1|=0 -> 0 (exact)
    // |3-6|=3 -> 2 (3-4 off)
    // |5-8|=3 -> 2 (3-4 off)
    // |7-2|=5 -> 3 (5+ off)
    // |9-0|=9 -> 3 (5+ off)
    expect(thermometerClue.compute("13579", "16820").tier).toEqual([
      0, 2, 2, 3, 3,
    ]);
  });
  it("groups 1 and 2 into the close tier (1)", () => {
    // |1-2|=1 -> 1; |2-4|=2 -> 1; |3-3|=0 -> 0
    expect(thermometerClue.compute("12300", "24300").tier).toEqual([
      1, 1, 0, 0, 0,
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
  it("compares the sorted-middle digit (5-digit)", () => {
    // guess 12345 median=3; target 54321 median=3 => eq
    expect(medianClue.compute("12345", "54321").cmp).toBe("eq");
    // guess 11111 median=1; target 99999 median=9 => target ↑
    expect(medianClue.compute("11111", "99999").cmp).toBe("gt");
    // guess 99999; target 11111 => target ↓
    expect(medianClue.compute("99999", "11111").cmp).toBe("lt");
  });
  it("uses the average of the two middle sorted digits for even length (6-digit)", () => {
    // sorted([1,2,3,4,8,9]) = [1,2,3,4,8,9]; median = (3+4)/2 = 3.5
    // sorted([0,2,4,5,6,9]) = [0,2,4,5,6,9]; median = (4+5)/2 = 4.5
    expect(medianClue.compute("123489", "024569").cmp).toBe("gt");
    // Same median (both 3.5): sorted [1,2,3,4,5,8] vs [0,2,3,4,7,9].
    // (3+4)/2 = 3.5 in both → eq.
    expect(medianClue.compute("123458", "023479").cmp).toBe("eq");
    // Target lower: target sorted [0,1,1,2,3,4] median=1.5; guess sorted
    // [3,4,5,6,7,8] median=5.5 → lt.
    expect(medianClue.compute("345678", "012134").cmp).toBe("lt");
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

describe("Ups and Downs", () => {
  it("counts monotonic runs", () => {
    expect(directionRuns("11111")).toBe(0); // all equal — no direction
    expect(directionRuns("12345")).toBe(1); // all up
    expect(directionRuns("54321")).toBe(1); // all down
    expect(directionRuns("24651")).toBe(2); // up, down
    expect(directionRuns("20054")).toBe(3); // down, up, down (00 doesn't count)
    expect(directionRuns("12121")).toBe(4); // up, down, up, down
    // 6-digit examples
    expect(directionRuns("123456")).toBe(1);
    expect(directionRuns("121212")).toBe(5);
  });
  it("compares target's run count to guess", () => {
    // 12345 → 1, 24651 → 2 → target ↑
    expect(upsAndDownsClue.compute("12345", "24651").cmp).toBe("gt");
    // 20054 → 3, 24651 → 2 → target ↓
    expect(upsAndDownsClue.compute("20054", "24651").cmp).toBe("lt");
    // 12321 → 2, 24651 → 2 → eq
    expect(upsAndDownsClue.compute("12321", "24651").cmp).toBe("eq");
  });
});

describe("Dice Count", () => {
  it("counts digits that are standard die values (1-6)", () => {
    // cmp convention: target vs guess. target 47628 has 4,6,2 = 3 die
    // values; guess 12345 has 1,2,3,4,5 = 5. 3 < 5 → lt.
    expect(diceCountClue.compute("12345", "47628").cmp).toBe("lt");
    // target 00009: 0 die values. guess 11111: 5 die values. 0 < 5 → lt
    expect(diceCountClue.compute("11111", "00009").cmp).toBe("lt");
    // target 12300: 1,2,3 = 3 die values. guess 45600: 4,5,6 = 3. eq.
    expect(diceCountClue.compute("45600", "12300").cmp).toBe("eq");
    // target 11111: 5 die values. guess 00000: 0 → gt
    expect(diceCountClue.compute("00000", "11111").cmp).toBe("gt");
  });
});

describe("Extra Lock (special)", () => {
  it("is in the special category with a flat result", () => {
    expect(extraLockClue.category).toBe("special");
    expect(extraLockClue.compute("12345", "54321")).toEqual({
      kind: "extraLock",
    });
  });
  it("reveals nothing about the target", () => {
    // compute should be independent of target/guess content.
    const a = extraLockClue.compute("00000", "74827");
    const b = extraLockClue.compute("99999", "11111");
    expect(a).toEqual(b);
  });
});

describe("6-digit length sanity", () => {
  // Targets and guesses chosen to exercise each clue without needing
  // hand-computed values (the assertions all derive from the inputs).
  const target6 = "247628";
  const guess6 = "555555";

  it("Bullseyes: returns hits array of length 6", () => {
    const r = bullseyesClue.compute(guess6, target6);
    expect(r.hits).toHaveLength(6);
    // None of guess's digits (all 5s) match target — none of target's
    // slots is 5.
    expect(r.hits.every((h) => !h)).toBe(true);
  });
  it("Higher or Lower: per-slot cmp array of length 6", () => {
    const r = higherLowerClue.compute(guess6, target6);
    expect(r.cmp).toHaveLength(6);
    // target[0]=2 < guess 5 → lt
    expect(r.cmp[0]).toBe("lt");
    // target[2]=7 > guess 5 → gt
    expect(r.cmp[2]).toBe("gt");
  });
  it("Within 2 / parity mask: arrays of length 6", () => {
    expect(within2Clue.compute(guess6, target6).mask).toHaveLength(6);
    expect(within2Clue.compute(guess6, target6).exact).toHaveLength(6);
    expect(parityMaskClue.compute(guess6, target6).matches).toHaveLength(6);
  });
  it("Thermometer: tier array of length 6", () => {
    expect(thermometerClue.compute(guess6, target6).tier).toHaveLength(6);
  });
  it("Sum Delta: digit-sum delta works at any length", () => {
    // target sum: 2+4+7+6+2+8 = 29; guess sum: 30. delta = -1.
    expect(sumDeltaClue.compute(guess6, target6).delta).toBe(-1);
  });
  it("Digit Overlap: multiset intersection caps correctly", () => {
    // guess "555555" vs target "247628" — target has zero 5s, so
    // overlap is 0.
    expect(digitOverlapClue.compute(guess6, target6).count).toBe(0);
    // Six 2s against target with two 2s → overlap = 2.
    expect(digitOverlapClue.compute("222222", target6).count).toBe(2);
  });
  it("Distinct Digits: counts up to puzzle length", () => {
    expect(distinctDigitsClue.compute(guess6, "012345").count).toBe(6);
    expect(distinctDigitsClue.compute(guess6, "111222").count).toBe(2);
  });
  it("Range / parity / prime / dice / total deviation: scale with length", () => {
    // Range: target 247628 → max 8 - min 2 = 6; guess 555555 → 0. target ↑.
    expect(rangeCompareClue.compute(guess6, target6).cmp).toBe("gt");
    // Even count: target 247628 → 4 (2,4,6,2,8); guess all 5s → 0.
    expect(parityBalanceClue.compute(guess6, target6).cmp).toBe("gt");
    // Prime count: target 247628 → primes are 2,7,2 = 3; guess 555555 → 6.
    expect(primeCountClue.compute(guess6, target6).cmp).toBe("lt");
    // Dice count (1-6): target 247628 → 2,4,6,2 = 4; guess 555555 → 6.
    expect(diceCountClue.compute(guess6, target6).cmp).toBe("lt");
    // Total deviation max: 9*6 = 54.
    expect(totalDeviationClue.compute("000000", "999999").value).toBe(54);
  });
  it("Contains Digit: present check works at length 6", () => {
    expect(
      containsDigitClue.compute(guess6, target6, { selectedDigit: 7 }).present,
    ).toBe(true);
    expect(
      containsDigitClue.compute(guess6, target6, { selectedDigit: 5 }).present,
    ).toBe(false);
  });
  it("Divisible By: 6-digit numeric value divisibility", () => {
    // 247628 / 2 = 123814 → divisible by 2.
    const r = divisibleByClue.compute(guess6, "247628");
    expect(r.present).toBe(true);
    // 247628 % 2 === 0; the seeded pick may choose any valid divisor.
    expect(r.divisor).not.toBeNull();
    expect(247628 % r.divisor!).toBe(0);
  });
  it("Oracle: reveals a slot inside the 6-digit range", () => {
    const r = oracleClue.compute(guess6, target6, { selectedSlot: 5 });
    expect(r.slot).toBe(5);
    expect(r.digit).toBe(8);
  });
});

describe("Registry", () => {
  it("has 20 clues, each weight > 0 and distinct id", () => {
    expect(CLUES).toHaveLength(20);
    const ids = new Set(CLUES.map((c) => c.id));
    expect(ids.size).toBe(20);
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
