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
import { bullseyeTrendClue } from "@/lib/game/clues/bullseyeTrend";
import { eliminationClue } from "@/lib/game/clues/elimination";
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

describe("Parity Mask (Odd or Even)", () => {
  it("highlights each slot whose parity matches the target's", () => {
    // guess 13579 vs target 02468: every slot is odd-vs-even → no
    // matches.
    expect(parityMaskClue.compute("13579", "02468").matches).toEqual([
      false, false, false, false, false,
    ]);
    // guess 13579 vs target 97531: all odd-odd → all match.
    expect(parityMaskClue.compute("13579", "97531").matches).toEqual([
      true, true, true, true, true,
    ]);
    // guess 13579 vs target 12468: only slot 0 matches (1 vs 1, both odd).
    expect(parityMaskClue.compute("13579", "12468").matches).toEqual([
      true, false, false, false, false,
    ]);
  });
});

describe("Bullseye Trend", () => {
  // Helper: target "12345" lets us craft prior + current pairs with
  // controlled match counts.
  const target = "12345";
  it("reports a positive delta when current guess has more exact matches than prior", () => {
    // prior "00000" has 0 matches; current "12000" has 2 matches → +2.
    const r = bullseyeTrendClue.compute("12000", target, {
      priorGuesses: ["00000"],
    });
    expect(r.delta).toBe(2);
  });
  it("reports a negative delta when current guess has fewer exact matches than prior", () => {
    // prior "12345" has 5 matches; current "00000" has 0 → −5.
    const r = bullseyeTrendClue.compute("00000", target, {
      priorGuesses: ["12345"],
    });
    expect(r.delta).toBe(-5);
  });
  it("reports delta=0 when current guess has the same exact-match count", () => {
    // prior "10000" has 1 match (slot 0=1); current "02000" has 1 match (slot 1=2).
    const r = bullseyeTrendClue.compute("02000", target, {
      priorGuesses: ["10000"],
    });
    expect(r.delta).toBe(0);
  });
  it("uses the most recent prior guess when multiple are present", () => {
    // earliest "12345" (5 matches), then "00000" (0 matches).
    // Current "10000" has 1 match. Compare against most recent ("00000",
    // 0 matches) → +1.
    const r = bullseyeTrendClue.compute("10000", target, {
      priorGuesses: ["12345", "00000"],
    });
    expect(r.delta).toBe(1);
  });
  it("defaults to delta=0 when no prior guesses are given (defensive)", () => {
    // Round-1 ineligibility means this branch shouldn't fire in
    // practice, but the defensive default keeps the result shape valid.
    const r = bullseyeTrendClue.compute("12345", target);
    expect(r.delta).toBe(0);
  });
});

describe("Oracle", () => {
  it("auto-picks the slot with the largest |guess[i] - target[i]|", () => {
    // User example: target 23456, guess 06906 → deltas 2, 3, 5, 5, 0.
    // Max is 5; tie between slots 2 and 3; leftmost wins → slot 2.
    const r = oracleClue.compute("06906", "23456");
    expect(r.slot).toBe(2);
    expect(r.digit).toBe(4);
  });
  it("uses leftmost-on-tie tiebreaking even when several slots share the max", () => {
    // target 11111, guess 99999 → all deltas are 8 (tied). Leftmost
    // wins → slot 0.
    const r = oracleClue.compute("99999", "11111");
    expect(r.slot).toBe(0);
    expect(r.digit).toBe(1);
  });
  it("returns digit at slot 0 when guess equals target everywhere except slot 0", () => {
    // target 23456, guess 92345 — wait, that shifts. Build a clearer
    // case: target 23456, guess 73456 → delta 5 at slot 0, 0 elsewhere.
    // Slot 0 wins.
    const r = oracleClue.compute("73456", "23456");
    expect(r.slot).toBe(0);
    expect(r.digit).toBe(2);
  });
  it("is pure on (guess, target)", () => {
    const a = oracleClue.compute("12345", "74827");
    const b = oracleClue.compute("12345", "74827");
    expect(a).toEqual(b);
  });
  it("returns a valid slot and the true digit there", () => {
    const target = "74827";
    const r = oracleClue.compute("00000", target);
    expect(r.slot).toBeGreaterThanOrEqual(0);
    expect(r.slot).toBeLessThan(target.length);
    expect(r.digit).toBe(Number(target[r.slot]));
  });
});

describe("Thermometer", () => {
  it("tiers distances into 3 buckets (0-1 / 2-3 / 4+)", () => {
    // |1-1|=0 -> 0 (0-1 off)
    // |3-6|=3 -> 1 (2-3 off)
    // |5-8|=3 -> 1 (2-3 off)
    // |7-2|=5 -> 2 (4+ off)
    // |9-0|=9 -> 2 (4+ off)
    expect(thermometerClue.compute("13579", "16820").tier).toEqual([
      0, 1, 1, 2, 2,
    ]);
  });
  it("groups |diff| 0 and 1 into the closest tier (0)", () => {
    // |1-2|=1 -> 0; |2-4|=2 -> 1; |3-3|=0 -> 0
    expect(thermometerClue.compute("12300", "24300").tier).toEqual([
      0, 1, 0, 0, 0,
    ]);
  });
});

describe("Digit Sum", () => {
  it("reports signed digit-sum delta (target - guess)", () => {
    const g = "12000";
    const t = "33333";
    expect(sumDeltaClue.compute(g, t).delta).toBe(15 - 3);
  });
  it("equal is 0", () => {
    expect(sumDeltaClue.compute("12345", "54321").delta).toBe(0);
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
  it("returns empty picks when no picks are provided", () => {
    const r = containsDigitClue.compute("12345", "67890");
    expect(r.picks).toEqual([]);
  });
  it("yellow when digit is in target but at a different slot", () => {
    // target 34564, guess 47684. slot 0 → digit 4. target[0]=3 (not
    // exact); 4 is in target → yellow.
    const r = containsDigitClue.compute("47684", "34564", { picks: [0] });
    expect(r.picks).toEqual([
      { slot: 0, digit: 4, present: true, exact: false },
    ]);
  });
  it("green on exact-slot match", () => {
    // target 34564, guess 47684. slot 4 → digit 4. target[4]=4 →
    // exact match.
    const r = containsDigitClue.compute("47684", "34564", { picks: [4] });
    expect(r.picks).toEqual([
      { slot: 4, digit: 4, present: true, exact: true },
    ]);
  });
  it("red when the digit is not in target", () => {
    // target 67890, guess 12345. slot 0 → digit 1. 1 not in target.
    const r = containsDigitClue.compute("12345", "67890", { picks: [0] });
    expect(r.picks).toEqual([
      { slot: 0, digit: 1, present: false, exact: false },
    ]);
  });
  it("walks user example 1 (target 34564, guess 47684, slots 2-0-4-3)", () => {
    // 1-indexed slots from the user's description map to 0-indexed
    // 2, 0, 4, 3. Expected: yellow, yellow, green, red.
    const r = containsDigitClue.compute("47684", "34564", {
      picks: [2, 0, 4, 3],
    });
    expect(r.picks).toEqual([
      { slot: 2, digit: 6, present: true, exact: false }, // yellow
      { slot: 0, digit: 4, present: true, exact: false }, // yellow
      { slot: 4, digit: 4, present: true, exact: true }, // green (other 4 still remaining)
      { slot: 3, digit: 8, present: false, exact: false }, // red
    ]);
  });
  it("walks user example 2 (target 12345, guess 45562, slots 1-2)", () => {
    // Strict multiset: slot 1 (digit 5) yellow consumes the only 5;
    // slot 2 (digit 5 again) is then red.
    const r = containsDigitClue.compute("45562", "12345", { picks: [1, 2] });
    expect(r.picks).toEqual([
      { slot: 1, digit: 5, present: true, exact: false },
      { slot: 2, digit: 5, present: false, exact: false },
    ]);
  });
  it("is pure on (guess, target, picks)", () => {
    const a = containsDigitClue.compute("12345", "67890", { picks: [3] });
    const b = containsDigitClue.compute("12345", "67890", { picks: [3] });
    expect(a).toEqual(b);
  });
});

describe("containsDigitAvailableSlots / containsDigitRoundComplete", () => {
  it("availableSlots returns indices not yet picked", async () => {
    const { containsDigitAvailableSlots } = await import(
      "@/lib/game/clues/containsDigit"
    );
    expect(containsDigitAvailableSlots(5, [])).toEqual([0, 1, 2, 3, 4]);
    expect(
      containsDigitAvailableSlots(5, [
        { slot: 2 } as { slot: number },
        { slot: 0 } as { slot: number },
      ]),
    ).toEqual([1, 3, 4]);
    expect(
      containsDigitAvailableSlots(5, [
        { slot: 0 } as { slot: number },
        { slot: 1 } as { slot: number },
        { slot: 2 } as { slot: number },
        { slot: 3 } as { slot: number },
        { slot: 4 } as { slot: number },
      ]),
    ).toEqual([]);
  });
  it("roundComplete returns true on red pick or all-slots-picked", async () => {
    const { containsDigitRoundComplete } = await import(
      "@/lib/game/clues/containsDigit"
    );
    expect(containsDigitRoundComplete("63442", [])).toBe(false);
    expect(
      containsDigitRoundComplete("63442", [{ present: true }]),
    ).toBe(false);
    // Red pick → done.
    expect(
      containsDigitRoundComplete("63442", [
        { present: true },
        { present: false },
      ]),
    ).toBe(true);
    // All slots picked → done.
    expect(
      containsDigitRoundComplete("63442", [
        { present: true },
        { present: true },
        { present: true },
        { present: true },
        { present: true },
      ]),
    ).toBe(true);
  });
});

describe("Distinct Digits", () => {
  it("counts unique digits in the target", () => {
    expect(distinctDigitsClue.compute("00000", "77727").count).toBe(2);
    expect(distinctDigitsClue.compute("00000", "12345").count).toBe(5);
    expect(distinctDigitsClue.compute("00000", "11111").count).toBe(1);
  });
  it("highlights guess slots whose digit is repeated in BOTH guess and target, capped at target's count", () => {
    // Target 22445 — counts {2:2, 4:2, 5:1}. Guess 35422 — counts
    // {3:1, 5:1, 4:1, 2:2}. Digit 2 is repeated in both; target has 2,
    // guess has 2 → highlight both 2-slots in guess (slots 3 and 4).
    const r = distinctDigitsClue.compute("35422", "22445");
    expect(r.count).toBe(3);
    expect(r.sharedRepeated).toEqual([false, false, false, true, true]);
  });
  it("user example: target 55606, guess 55705 → only the FIRST TWO 5s", () => {
    // target 55606 has two 5s; guess 55705 has three 5s (slots 0, 1, 4).
    // Highlight only the leftmost two — the 3rd 5 (slot 4) is a wasted
    // duplicate.
    const r = distinctDigitsClue.compute("55705", "55606");
    expect(r.sharedRepeated).toEqual([true, true, false, false, false]);
  });
  it("does not highlight if a digit is repeated in only one of guess/target", () => {
    // Target 22345 repeats {2}; guess 11234 repeats {1}. No overlap.
    const r = distinctDigitsClue.compute("11234", "22345");
    expect(r.sharedRepeated).toEqual([false, false, false, false, false]);
  });
  it("highlights every slot when both guess and target are uniform", () => {
    // Guess 33333 (count {3:5}), target 33333 (count {3:5}); cap at
    // target's 5 means all five slots highlight.
    const r = distinctDigitsClue.compute("33333", "33333");
    expect(r.count).toBe(1);
    expect(r.sharedRepeated).toEqual([true, true, true, true, true]);
  });
  it("caps highlights at target's count when guess has more duplicates than target", () => {
    // Target 11222 (count {1:2, 2:3}), guess 11122 (count {1:3, 2:2}).
    // Digit 1: target has 2, guess has 3 → highlight leftmost 2 (slots 0, 1).
    // Digit 2: target has 3, guess has 2 → both 2-slots highlight (slots 3, 4).
    const r = distinctDigitsClue.compute("11122", "11222");
    expect(r.sharedRepeated).toEqual([true, true, false, true, true]);
  });
});

describe("Digit Overlap", () => {
  it("marks slots whose digit appears in the target (distinct digits)", () => {
    // target "12345"; guess "13579":
    //   slot 0 '1' ✓ (target has one 1, consumed by slot 0)
    //   slot 1 '3' ✓
    //   slot 2 '5' ✓
    //   slot 3 '7' ✗
    //   slot 4 '9' ✗
    expect(digitOverlapClue.compute("13579", "12345").mask).toEqual([
      true, true, true, false, false,
    ]);
  });
  it("only highlights up to the target's count for repeated guess digits", () => {
    // Target has only ONE '1', so a guess of "11111" gets exactly one
    // warm slot (the first; subsequent 1s are 'wasted' duplicates).
    expect(digitOverlapClue.compute("11111", "12345").mask).toEqual([
      true, false, false, false, false,
    ]);
  });
  it("multiset example A: target 44532, guess 55341 → first 5, the 3, the 4", () => {
    expect(digitOverlapClue.compute("55341", "44532").mask).toEqual([
      true, false, true, true, false,
    ]);
  });
  it("multiset example B: target 44321, guess 24544 → 2, first two 4s only", () => {
    expect(digitOverlapClue.compute("24544", "44321").mask).toEqual([
      true, true, false, true, false,
    ]);
  });
  it("all-false when no guess digit is in target", () => {
    expect(digitOverlapClue.compute("66666", "12345").mask).toEqual([
      false, false, false, false, false,
    ]);
  });
});

describe("Elimination", () => {
  it("marks slots whose digit is ABSENT from the target", () => {
    // Inverse of the Echo case above.
    expect(eliminationClue.compute("13579", "12345").mask).toEqual([
      false, false, false, true, true,
    ]);
  });
  it("inverts Digit Overlap when the guess has no repeated digits beyond the target's count", () => {
    // With distinct guess digits, Digit Overlap's multiset rule
    // degrades to simple "is digit present", so Elimination is the
    // exact inverse.
    const cases: [string, string][] = [
      ["13579", "12345"],
      ["00000", "12345"],
      ["12345", "12345"],
      ["66666", "12345"],
    ];
    for (const [g, t] of cases) {
      const overlap = digitOverlapClue.compute(g, t).mask;
      const elim = eliminationClue.compute(g, t).mask;
      expect(elim).toEqual(overlap.map((m) => !m));
    }
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
  it("intersects target's 2-9 divisors with the guess's 2-9 divisors", () => {
    // Target 12348 (= 2² × 3 × 7² × 21) → divisors 2-9: {2, 3, 4, 6, 7, 9}.
    //   Verify: 12348/2=6174 ✓, /3=4116 ✓, /4=3087 ✓, /6=2058 ✓, /7=1764 ✓,
    //   /9=1372 ✓; /5,/8 no.
    // Guess 24630 (= 2 × 3 × 5 × 821) → divisors 2-9: {2, 3, 5, 6}.
    // Intersection (preserved in target order): {2, 3, 6}.
    const r = divisibleByClue.compute("24630", "12348");
    expect(r.divisors).toEqual([2, 3, 6]);
    expect(r.targetHasAny).toBe(true);
  });
  it("reports targetHasAny=true with empty divisors when target has 2-9 divisors but none match guess", () => {
    // Target 12345 → divisors 2-9: {3, 5}.
    // Guess 22228 → divisors 2-9: {2, 4}. Intersection: {}.
    const r = divisibleByClue.compute("22228", "12345");
    expect(r.divisors).toEqual([]);
    expect(r.targetHasAny).toBe(true);
  });
  it("reports targetHasAny=false when target has no 2-9 divisors at all", () => {
    // 10007 is prime → divisors 2-9: {}.
    const r = divisibleByClue.compute("12345", "10007");
    expect(r.divisors).toEqual([]);
    expect(r.targetHasAny).toBe(false);
  });
  it("preserves divisor order from the target's divisor list", () => {
    // Target 12348 divisors in 2-9 order: [2, 3, 4, 6, 7, 9].
    // Guess that matches all of them: 12348 itself.
    const r = divisibleByClue.compute("12348", "12348");
    expect(r.divisors).toEqual([2, 3, 4, 6, 7, 9]);
  });
  it("is deterministic and pure on (guess, target)", () => {
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
  it("Within 2: arrays of length 6", () => {
    expect(within2Clue.compute(guess6, target6).mask).toHaveLength(6);
    expect(within2Clue.compute(guess6, target6).exact).toHaveLength(6);
  });
  it("Parity Mask: matches array of length 6", () => {
    expect(parityMaskClue.compute(guess6, target6).matches).toHaveLength(6);
  });
  it("Thermometer: tier array of length 6", () => {
    expect(thermometerClue.compute(guess6, target6).tier).toHaveLength(6);
  });
  it("Sum Delta: digit-sum delta works at any length", () => {
    // target sum: 2+4+7+6+2+8 = 29; guess sum: 30. delta = -1.
    expect(sumDeltaClue.compute(guess6, target6).delta).toBe(-1);
  });
  it("Digit Overlap: multiset mask caps correctly", () => {
    // guess "555555" vs target "247628" — target has zero 5s, so
    // every slot stays cold.
    expect(digitOverlapClue.compute(guess6, target6).mask).toEqual([
      false, false, false, false, false, false,
    ]);
    // Six 2s against target with two 2s → first two slots warm, rest cold.
    expect(digitOverlapClue.compute("222222", target6).mask).toEqual([
      true, true, false, false, false, false,
    ]);
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
  it("Contains Digit: slot-based picks work at length 6", () => {
    // guess6 = "555555", target6 = "247628". Every slot's digit is 5;
    // 5 isn't in target → red on the first pick.
    const r0 = containsDigitClue.compute(guess6, target6, { picks: [0] });
    expect(r0.picks).toEqual([
      { slot: 0, digit: 5, present: false, exact: false },
    ]);
    // A guess sharing a digit with the target shows yellow (present
    // but at a different slot). guess "777777" picks slot 5 → digit 7;
    // target[5] = "8" so not exact, but 7 IS in target → yellow.
    const r7 = containsDigitClue.compute("777777", target6, { picks: [5] });
    expect(r7.picks).toEqual([
      { slot: 5, digit: 7, present: true, exact: false },
    ]);
    // guess "247628" exactly matches target — slot 0 → green.
    const rExact = containsDigitClue.compute("247628", target6, { picks: [0] });
    expect(rExact.picks).toEqual([
      { slot: 0, digit: 2, present: true, exact: true },
    ]);
  });
  it("Divisible By: 6-digit numeric value divisibility", () => {
    // Target 247628 divisors 2-9: {2, 4} (247628/2=123814, /4=61907; not /3,
    // /5, /6, /7, /8, /9). Guess 555555 divisors 2-9: {3, 5} (5+5+5+5+5+5=30
    // divides by 3, ends in 5 so divides by 5; not by 2/4/6/8 since odd, not
    // /7, not /9 since 30/9 isn't integer). Intersection: {}.
    const r = divisibleByClue.compute(guess6, "247628");
    expect(r.targetHasAny).toBe(true);
    expect(r.divisors).toEqual([]);
  });
  it("Oracle: reveals the leftmost largest-delta slot inside the 6-digit range", () => {
    // target 247628, guess 555555 → deltas [3,1,2,1,3,3]. Max=3 ties
    // among slots 0, 4, 5; leftmost wins → slot 0 (digit 2).
    const r = oracleClue.compute(guess6, target6);
    expect(r.slot).toBe(0);
    expect(r.digit).toBe(2);
  });
});

describe("Registry", () => {
  it("has 22 clues, each weight > 0 and distinct id", () => {
    expect(CLUES).toHaveLength(22);
    const ids = new Set(CLUES.map((c) => c.id));
    expect(ids.size).toBe(22);
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
