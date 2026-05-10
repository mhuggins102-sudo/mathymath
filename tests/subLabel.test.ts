import { describe, it, expect } from "vitest";
import { subLabelFor } from "@/components/GuessRow";
import { isOracleWinRow } from "@/components/GuessGrid";

describe("subLabelFor — cmp clues show symbol + player's own value", () => {
  it("Stat Summary — median + range cmps with per-part coloring", () => {
    // guess "12345": median=3, range=4.
    expect(
      subLabelFor("12345", {
        kind: "statSummary",
        medianCmp: "eq",
        rangeCmp: "gt",
      }),
    ).toEqual({
      text: "M=3 R>4",
      className: "",
      parts: [
        { text: "M=3", className: "text-good" },
        { text: "R>4", className: "text-warn" },
      ],
    });
    // guess "99111": sorted [1,1,1,9,9] → median 1, range 8. Both lt.
    expect(
      subLabelFor("99111", {
        kind: "statSummary",
        medianCmp: "lt",
        rangeCmp: "lt",
      }),
    ).toEqual({
      text: "M<1 R<8",
      className: "",
      parts: [
        { text: "M<1", className: "text-bad" },
        { text: "R<8", className: "text-bad" },
      ],
    });
  });

  it("Digit Class — even / prime / dice cmps", () => {
    // guess "24680": evens=5, primes=1 (2), dice=3 (2,4,6).
    expect(
      subLabelFor("24680", {
        kind: "digitClass",
        evenCmp: "eq",
        primeCmp: "gt",
        diceCmp: "lt",
      }),
    ).toEqual({
      text: "E=5 P>1 D<3",
      className: "",
      parts: [
        { text: "E=5", className: "text-good" },
        { text: "P>1", className: "text-warn" },
        { text: "D<3", className: "text-bad" },
      ],
    });
  });

  it("Ups and Downs", () => {
    // 24651 has 2 direction changes (up then down).
    expect(subLabelFor("24651", { kind: "upsAndDowns", cmp: "eq" })).toEqual({
      text: "= 2",
      className: "text-good",
    });
    // 12345 has 1 direction; ">" means target has more than 1.
    expect(subLabelFor("12345", { kind: "upsAndDowns", cmp: "gt" })).toEqual({
      text: "> 1",
      className: "text-warn",
    });
    // 11111 has 0 direction changes.
    expect(subLabelFor("11111", { kind: "upsAndDowns", cmp: "lt" })).toEqual({
      text: "< 0",
      className: "text-bad",
    });
  });
});

describe("subLabelFor — Digit Sum shows target sum + signed delta", () => {
  it("equal: shows just the target sum (= player's own)", () => {
    expect(subLabelFor("12345", { kind: "sumDelta", delta: 0 })).toEqual({
      text: "15",
      className: "text-good",
    });
  });
  it("positive delta: '<targetSum> (+n)'", () => {
    // 11111 sums to 5; delta +7 → target sum 12.
    expect(subLabelFor("11111", { kind: "sumDelta", delta: 7 })).toEqual({
      text: "12 (+7)",
      className: "text-warn",
    });
  });
  it("negative delta: '<targetSum> (−n)'", () => {
    // 99999 sums to 45; delta -12 → target sum 33.
    expect(subLabelFor("99999", { kind: "sumDelta", delta: -12 })).toEqual({
      text: "33 (−12)",
      className: "text-bad",
    });
  });
});

describe("subLabelFor — other clues unchanged", () => {
  it("Contains Digit (slot-based picks: green ✓✓ / yellow ✓ / red ✗)", () => {
    // Yellow only — single pick, digit present at a different slot.
    expect(
      subLabelFor("11111", {
        kind: "containsDigit",
        picks: [{ slot: 0, digit: 7, present: true, exact: false }],
      }),
    ).toEqual({
      text: "7✓",
      className: "text-warn",
      parts: [{ text: "7✓", className: "text-warn" }],
    });
    // Red — single pick, digit absent.
    expect(
      subLabelFor("11111", {
        kind: "containsDigit",
        picks: [{ slot: 0, digit: 7, present: false, exact: false }],
      }),
    ).toEqual({
      text: "7✗",
      className: "text-bad",
      parts: [{ text: "7✗", className: "text-bad" }],
    });
    // Mixed sequence: yellow + green (exact) + red. The mark stays
    // a single ✓ for both yellow and green — color alone separates
    // them. Summary class follows the LAST pick (red here).
    expect(
      subLabelFor("11111", {
        kind: "containsDigit",
        picks: [
          { slot: 0, digit: 4, present: true, exact: false },
          { slot: 1, digit: 4, present: true, exact: true },
          { slot: 2, digit: 6, present: false, exact: false },
        ],
      }),
    ).toEqual({
      text: "4✓ 4✓ 6✗",
      className: "text-bad",
      parts: [
        { text: "4✓", className: "text-warn" },
        { text: "4✓", className: "text-good" },
        { text: "6✗", className: "text-bad" },
      ],
    });
  });
  it("Digit Overlap (per-digit ✓ marks, distinct in guess order)", () => {
    // Target 12243, guess 55776 + (mask shape) — distinct hit digits
    // listed in guess order with a ✓ each, capped to those that
    // actually fired in the multiset-aware mask.
    expect(
      subLabelFor("55776", {
        kind: "digitOverlap",
        mask: [true, false, true, false, false],
      }),
    ).toEqual({ text: "5✓ 7✓", className: "text-warn" });
    // Empty hits → "no hits" muted.
    expect(
      subLabelFor("55776", {
        kind: "digitOverlap",
        mask: [false, false, false, false, false],
      }),
    ).toEqual({ text: "no hits", className: "text-muted" });
  });
  it("Elimination (per-digit ✗ marks, distinct in guess order)", () => {
    // Target 57243, guess 55776 → only the 6 cold; 5/7 are present in
    // target so they aren't excluded even though the guess has more
    // copies than the target.
    expect(
      subLabelFor("55776", {
        kind: "elimination",
        mask: [false, false, false, false, true],
      }),
    ).toEqual({ text: "6✗", className: "text-bad" });
    // Empty exclude set → "no misses" muted.
    expect(
      subLabelFor("12345", {
        kind: "elimination",
        mask: [false, false, false, false, false],
      }),
    ).toEqual({ text: "no misses", className: "text-muted" });
  });
  it("Bullseye Trend (signed delta with explicit count, no arrows)", () => {
    expect(
      subLabelFor("12345", { kind: "bullseyeTrend", delta: 2 }),
    ).toEqual({ text: "2 more", className: "text-good" });
    expect(
      subLabelFor("12345", { kind: "bullseyeTrend", delta: -3 }),
    ).toEqual({ text: "3 less", className: "text-bad" });
    expect(
      subLabelFor("12345", { kind: "bullseyeTrend", delta: 0 }),
    ).toEqual({ text: "= same", className: "text-muted" });
  });
  it("Oracle (shows |guess[slot] - revealed digit| as '# off')", () => {
    // guess "06906", revealed slot 2 with digit 4 → |9-4|=5.
    expect(
      subLabelFor("06906", { kind: "oracle", slot: 2, digit: 4 }),
    ).toEqual({ text: "5 off", className: "text-accent" });
    // guess "12345", revealed slot 3 with target digit 5 → |4-5|=1.
    expect(
      subLabelFor("12345", { kind: "oracle", slot: 3, digit: 5 }),
    ).toEqual({ text: "1 off", className: "text-accent" });
  });
});

describe("isOracleWinRow", () => {
  // The grid uses this to decide when to repaint the last resolved
  // row as a full match (target shown across every slot) instead of
  // showing only the single Oracle-revealed slot.
  const oracleGuess = {
    guess: "12340",
    clueId: "oracle" as const,
    result: { kind: "oracle" as const, slot: 4, digit: 5 },
  };
  const sumDeltaGuess = {
    guess: "11111",
    clueId: "sumDelta" as const,
    result: { kind: "sumDelta" as const, delta: 9 },
  };
  it("fires on the last row when status is won and result is Oracle", () => {
    const state = {
      status: "won" as const,
      guesses: [sumDeltaGuess, oracleGuess],
    };
    expect(isOracleWinRow(state, 1)).toBe(true);
  });
  it("does NOT fire on earlier rows even if they used Oracle", () => {
    const state = {
      status: "won" as const,
      guesses: [oracleGuess, sumDeltaGuess, oracleGuess],
    };
    expect(isOracleWinRow(state, 0)).toBe(false);
    expect(isOracleWinRow(state, 1)).toBe(false);
    expect(isOracleWinRow(state, 2)).toBe(true);
  });
  it("does NOT fire while the game is still playing", () => {
    const state = {
      status: "playing" as const,
      guesses: [oracleGuess],
    };
    expect(isOracleWinRow(state, 0)).toBe(false);
  });
  it("does NOT fire on a bullseyes / non-oracle win row", () => {
    const state = {
      status: "won" as const,
      guesses: [
        {
          guess: "12345",
          clueId: "bullseyes" as const,
          result: {
            kind: "bullseyes" as const,
            hits: [true, true, true, true, true],
          },
        },
      ],
    };
    expect(isOracleWinRow(state, 0)).toBe(false);
  });
  it("fires when Oracle was reached via Clue Reuse (result.kind, not clueId)", () => {
    // Clue Reuse delegates to the underlying clue, so result.kind is
    // "oracle" even though the stored clueId is "clueReuse". The grid
    // keys off result.kind so this case still triggers the win paint.
    const state = {
      status: "won" as const,
      guesses: [
        {
          guess: "12340",
          clueId: "clueReuse" as const,
          result: { kind: "oracle" as const, slot: 4, digit: 5 },
        },
      ],
    };
    expect(isOracleWinRow(state, 0)).toBe(true);
  });
});
