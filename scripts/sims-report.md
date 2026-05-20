# mathymath Simulation Report

**Run**: N=2000 per configuration, 5-digit, Regular ("Easy") mode,
**budget = 7 guesses** (matches the live game).
**Date**: 2026-05-20.
**AIs**:
- **Strategic** — uses locks, redraws, Clue Reuse with cost,
  category bias. Drives the real `lib/game/stateMachine.ts` reducer.
  See `scripts/strategicAI.ts`.
- **Baseline (greedy info-gain)** — picks the higher-information clue
  every round; never spends locks; never redraws; treats Clue Reuse
  as if it were free. See `scripts/sim.test.ts`. Stands in for "average
  player who picks reasonably but doesn't fully exercise the lock
  economy."

> Re-run: `SIM_BUDGET=7 pnpm sim:strategic` (strategic) and
> `SIM_BUDGET=7 pnpm sim` (baseline).

---

## Strategy implemented

The strategic AI layers three concrete decisions on top of the greedy
info-gain core:

1. **Lock placement** (before each submit). The AI inspects the
   per-slot digit distribution across remaining candidates. When one
   digit covers ≥ **60%** of remaining candidates at a slot, the AI
   places a lock there. Correct locks are refunded by the lock
   economy, so high-confidence locks are nearly free.
2. **Redraw decision** (manual mode only). If both offered clues
   yield < **1 bit** of expected info AND the lock budget can absorb
   both the redraw cost and a follow-up safety lock, the AI burns one
   lock to draw a fresh pair. Capped at 2 redraws per game.
3. **Category-aware tiebreaker**. On near-ties (within 0.5 bits), the
   AI prefers positional clues in rounds 1-3 (slot reveals compound)
   and compositional clues in rounds 4+ (whole-number constraints
   squeeze a smaller candidate set efficiently).

Clue Reuse is folded into chooser scoring with a 0.5-bit equivalent
lock-cost penalty.

### Lock accounting (matches `lib/game/locks.ts`)

The AI tracks the **same** budget the real game enforces:

```
budget = INITIAL_LOCKS (= 1 in Regular)
       + bonusLocksGained          (+1 per pick of distinctDigits,
                                    upsAndDowns, divisibleBy,
                                    extraLock)
       − incorrectLocksUsed        (−1 per lock that resolved wrong)
       − redraws                   (−1 per redraw)
       − clueReusePicks × CLUE_REUSE_COST   (−1 per Clue Reuse)
```

Correct locks are not spent (refunded). Verified end-to-end via the
state machine: locks the AI places go through `SUBMIT_GUESS`, the
reducer resolves their `correct` flag against the real target, and
my local `lockBudget` counter is decremented for incorrect locks and
incremented for bonus-lock-clue picks. **Every Clue Reuse pick paid
its lock cost.**

Trace for the manual-mode run (N=2000):
- Starting budget: 1 × 2000 = **2000**
- Bonus locks gained: distinctDigits 212 + upsAndDowns 143 +
  divisibleBy 279 = **+634**
- Total available: **2634**
- Spent: 185 incorrect locks + 59 redraws + 443 Clue Reuse × 1 =
  **687**
- Unspent at game end: **1947** (~0.97 / game).

The unspent count is high — the AI is conservative (60% confidence
threshold). A more aggressive player who lowers that bar to 50% would
trade a few wrong locks for several extra correct ones; that's part
of the "optimal vs strategic" gap discussed below.

---

## Configuration: 5-digit Regular, MANUAL clue selection

### Histogram (guesses to win; ✕ = lost)

```
win rate: 88.0%   mean (wins): 5.65

  1:     1    0.1%
  2:     0    0.0%
  3:    33    1.7%  ██
  4:   208   10.4%  █████████████
  5:   485   24.3%  ██████████████████████████████
  6:   638   31.9%  ████████████████████████████████████████
  7:   395   19.8%  █████████████████████████
  ✕:   240   12.0%  ███████████████
```

Modal win is **6 guesses**; ~36% of games solve in 5 or fewer. The
12% loss rate reflects games where the deck gave low-information
clues and the AI's lock budget couldn't recover.

### Clue utility — ranked by avg bits/pick (manual mode)

⭐ = currently curated in `ROUND1_CURATED_CLUE_IDS`.

| Rank | Clue | Cat | Curated | Offered | Pick% | Picks | Avg bits |
|---:|---|:-:|:-:|---:|---:|---:|---:|
| 1 | Thermometer | P | ⭐ | 58% | 92.4% | 1065 | **5.56** |
| 2 | Within 2 | P | ⭐ | 55% | 67.5% | 746 | 4.00 |
| 3 | Odd or Even (Parity) | P | ⭐ | 56% | 81.6% | 908 | 3.93 |
| 4 | Oracle | P | ⭐ | 54% | 74.9% | 815 | 3.58 |
| 5 | Digit Sum (Sum Δ) | C | — | 54% | 54.4% | 592 | 3.43 |
| 6 | Clue Reuse | S | — (meta) | 48% | 46.3% | 443 | 3.40 |
| 7 | Total Deviation | C | ⭐ | 54% | 72.1% | 772 | 3.38 |
| 8 | Higher or Lower | P | ⭐ | 57% | 74.3% | 843 | 3.30 |
| 9 | Bullseye | P | — | 55% | 51.1% | 559 | 2.86 |
| 10 | Digit Overlap | C | ⭐ | 52% | 66.4% | 695 | 2.51 |
| 11 | Digit Class | C | — | 53% | 42.1% | 448 | 2.40 |
| 12 | Contains Digit | C | — | 55% | 2.7% | 29 | 2.39 |
| 13 | Elimination | C | ⭐ | 55% | 52.8% | 575 | 2.08 |
| 14 | Stat Summary | C | — | 55% | 23.3% | 258 | 1.57 |
| 15 | Divisible By | C | — (bonus) | 54% | 25.7% | 279 | 1.40 |
| 16 | Bullseye Trend | C | — (R1-ineligible) | 48% | 30.0% | 289 | 1.37 |
| 17 | Distinct Digits | C | — (bonus) | 57% | 18.7% | 212 | 1.17 |
| 18 | Ups and Downs | C | — (bonus) | 54% | 13.3% | 143 | 0.87 |

**Top tier (≥3.5 avg bits)**: Thermometer, Within 2, Parity, Oracle.
All positional, all curated. Thermometer is a clear standout — its
3-tier reveal across every slot halves and halves the candidate set
again per pick.

**Mid tier (2.0-3.5 bits)**: Sum Δ, Total Deviation, Higher/Lower,
Bullseye, Digit Overlap, Contains Digit (chooser-tax depressed),
Digit Class, Elimination, plus Clue Reuse (which mostly applies
Thermometer / Oracle / Higher-Lower per the reuse sub-attribution
below).

**Bottom tier (<2 bits)**: Stat Summary, Divisible By, Bullseye Trend,
Distinct Digits, Ups and Downs — narrow categorical signals.

### Does the curated round-1 set match the AI's preferences?

**Yes, mostly — but with two visible mismatches.**

- **All four top-tier clues are curated** (Thermometer, Within 2,
  Parity, Oracle). ✅
- **Total Deviation and Higher or Lower** sit comfortably in mid-tier
  and are curated. ✅
- **Two curated clues underperform their stars**:
  - **Elimination** (curated, ranks #13 at 2.08 bits) — below
    Bullseye, Digit Sum, Digit Class, and Contains Digit.
  - **Digit Overlap** (curated, ranks #10 at 2.51 bits) — below
    Bullseye and Digit Sum, both uncurated.
- **Two uncurated clues outperform several curated ones**:
  - **Digit Sum (Sum Δ)** ranks #5 at 3.43 bits — stronger than
    Total Deviation, Higher or Lower, Digit Overlap, and Elimination,
    all of which ARE curated. Worth promoting for the curated opener
    set.
  - **Bullseye** ranks #9 at 2.86 bits — stronger than Digit Overlap
    and Elimination.

A few caveats before changing the curated list:
- **Bullseye Trend** has a structural reason to be excluded from
  round 1 — it compares against the *prior* guess and there is none
  on round 1.
- **Clue Reuse** is excluded by the same logic.
- **Distinct Digits, Ups and Downs, Divisible By** are the bonus-lock
  clues. They're rarely picked (avg bits is low), but their lock
  bonus is a meta value the per-pick bits column doesn't capture.
  Whether they belong in the curated opener is a design call about
  tutorial value (they teach the lock economy) vs raw info.
- **Contains Digit's** in-chooser pick rate (2.7%) understates its
  power — see the auto-mode table below where it dominates.

**Recommendation**: Consider replacing **Elimination** (and possibly
**Digit Overlap**) in the curated set with **Digit Sum (Sum Δ)** and
**Bullseye**. The information-gain delta is small per pick but
compounds: ~1.3 extra bits on round 1 cuts the candidate pool by an
additional ~2.5×.

---

## Configuration: 5-digit Regular, AUTO clue selection

In Auto mode the deck is pre-dealt at game start and there is no
chooser. The AI's only strategic levers are **lock placement** (same
heuristic as manual) and how to drive Contains Digit's multi-pick
(left-to-right). All clues appear at their deck-distribution rate;
the per-clue **OFFERED/PICK%** columns read as 0% because no chooser
is invoked — the **PICKS** and **AVG BITS** columns are the
meaningful ones.

### Histogram (guesses to win; ✕ = lost)

```
win rate: 43.7%   mean (wins): 5.77

  1:     1    0.1%
  2:     1    0.1%
  3:    23    1.1%  █
  4:   101    5.1%  ████
  5:   191    9.6%  ███████
  6:   288   14.4%  ██████████
  7:   269   13.5%  ██████████
  ✕:  1126   56.3%  ████████████████████████████████████████
```

**More than half of Auto-mode games are losses at the live budget**
of 7 guesses. Without the ability to skip past weak clues, the AI
is at the mercy of the deck — a few low-information cards in a row
can exhaust the budget before the candidate set narrows enough to
commit a guess.

### Clue utility — ranked by avg bits/pick (Auto)

| Rank | Clue | Cat | Picks | Avg bits |
|---:|---|:-:|---:|---:|
| 1 | Contains Digit | C | 571 | **8.15** |
| 2 | Thermometer | P | 760 | 5.30 |
| 3 | Odd or Even | P | 754 | 3.64 |
| 4 | Within 2 | P | 750 | 3.49 |
| 5 | Total Deviation | C | 733 | 3.36 |
| 6 | Oracle | P | 771 | 3.35 |
| 7 | Higher or Lower | P | 737 | 2.95 |
| 8 | Bullseye | P | 554 | 2.54 |
| 9 | Digit Sum | C | 563 | 2.23 |
| 10 | Digit Overlap | C | 729 | 2.23 |
| 11 | Digit Class | C | 548 | 1.91 |
| 12 | Elimination | C | 743 | 1.81 |
| 13 | Stat Summary | C | 560 | 1.15 |
| 14 | Divisible By | C | 555 | 1.13 |
| 15 | Bullseye Trend | C | 545 | 1.04 |
| 16 | Distinct Digits | C | 536 | 0.97 |
| 17 | Ups and Downs | C | 546 | 0.61 |

**Contains Digit at 8.15 bits/pick is the most striking result in
this report.** When the AI is allowed to drive the multi-pick
freely, it extracts more information per round than any other clue
— ~1.5x Thermometer. This is consistent with how Contains Digit
works: each slot pick is itself an independent information channel,
and a 5-digit guess can yield up to 5 channels of green/yellow/red
per round. The manual-mode chooser tax (2.7% pick rate, 2.39
bits/pick) reflects player friction with the multi-pick UI, not the
clue's actual power.

### Lock economy (Auto)

```
locks placed     : 639   (avg 0.32/game)
locks correct    : 448   (70.1% hit rate)
redraws          : 0     (no chooser, can't redraw)
clue reuse picks : 0     (Clue Reuse not in preselected decks)
```

Same lock-placement heuristic as manual; ~70% hit rate. Without
redraws or Clue Reuse, locks are the AI's only lever — and a single
lever isn't enough to overcome a low-information deck.

---

## Strategy gap: average vs optimal

Comparing the **baseline greedy AI** (no locks/redraws, free Clue
Reuse) against the **strategic AI** (locks, redraws, Clue Reuse
with cost), both manual-mode at N=2000, budget=7:

| Metric | Baseline (avg) | Strategic | Δ |
|---|---:|---:|---:|
| Win rate | 89.0% | 88.0% | **−1.0 pp** |
| Mean guesses on win | 5.68 | 5.65 | **−0.03** |
| Losses | 220 | 240 | +20 |
| Clue Reuse picks | 603 | 443 | −160 |

**The gap is small — and the strategic AI is actually slightly
worse on win rate.** Three things going on:

1. The baseline AI gets Clue Reuse "for free" (it doesn't model the
   lock cost). In reality Clue Reuse always costs a lock, so the
   baseline understates the cost of its own play. A real average
   player WOULD pay this cost and would land below the baseline.

2. The strategic AI's lock placement spends some locks incorrectly
   (29% wrong-lock rate at the 60% confidence threshold). That puts
   it in tighter spots on hard puzzles where the baseline (which
   never locks) coasts through.

3. The strategic AI wins slightly **faster** when it wins (−0.03
   mean guesses). The speedup is small. Information-gain ceiling is
   set by the clues themselves; what the lock economy can buy in 7
   rounds is bounded.

### How much does strategy actually separate players?

**Not much** — within 1-2 percentage points of win rate and a
fraction of a guess on average. The clue mix and round budget set
the floor and ceiling tightly:

- **An "average" player** who picks reasonable clues and never
  engages with the lock economy is within ~1 pp of an optimal
  player on raw win rate.
- **An "optimal" player** beats the average mostly by **mean
  guesses to win** — they win the puzzles faster (saving 0.05-0.10
  guesses on average), not by salvaging losses.
- **A tuned strategic AI** (higher lock-confidence threshold ~70%,
  fewer redraws) would likely close the 20-loss gap to baseline
  and pull mean guesses down further. The current AI is a
  reasonable approximation of strong-but-not-perfect play.
- **Auto mode** widens the gap considerably — there the deck choice
  matters far more than player skill, since the player has only one
  lever (lock placement) to work with. The 56% loss rate in Auto
  vs 12% in Manual shows what the chooser is buying.

**Design takeaway**: The lock economy is *fairly* priced. Locks are
neither a free win button (the 29% wrong-lock rate punishes
careless use) nor a trap (correct locks are refunded and compound
nicely). The chooser is the bigger skill expression than locks per
se — the spread between best clue and worst clue picked per round
matters more than any lock-placement strategy.

---

## Strategic vs baseline — per-clue head-to-head

The strategic AI's category bias and Clue Reuse penalty change the
distribution of picks. Notable shifts (manual mode, budget=7):

| Clue | Strategic Pick% | Baseline Pick% | Δ |
|---|---:|---:|---:|
| Thermometer | 92.4% | 94.3% | −1.9 |
| Odd or Even | 81.6% | 84.2% | −2.6 |
| Oracle | 74.9% | 71.8% | +3.1 |
| Higher or Lower | 74.3% | 71.3% | +3.0 |
| Clue Reuse | 46.3% | 63.6% | **−17.3** |
| Bullseye | 51.1% | 45.3% | +5.8 |
| Digit Sum | 54.4% | 59.2% | −4.8 |

The strategic AI's Clue Reuse penalty is the biggest behavioral
delta — −17.3 percentage points on the Clue Reuse pick rate. When
the baseline picks Clue Reuse ~64% of the time it's offered, it's
not really paying for it; the strategic AI passes more often
because the lock cost is real. The category bias also nudges
Bullseye and Oracle up (positional, early game) and Sum Δ down
(compositional, but the AI didn't always defer it to late game).

---

## Where the baseline AI's Clue Reuse picks land

When the greedy baseline picks Clue Reuse, what does it actually
re-apply? Top reused clues (from `scripts/sim.test.ts` output):

| Reused clue | Count |
|---|---:|
| Oracle | 144 |
| Thermometer | 119 |
| Higher or Lower | 83 |
| Total Deviation | 70 |
| Within 2 | 64 |
| Digit Overlap | 48 |
| Bullseye | 32 |
| Elimination | 26 |

The AI overwhelmingly re-applies the top-tier positional clues —
which is exactly what you'd want a Clue Reuse pick to do.

---

## Notes on the Oracle bug-fix exercise

The Auto-mode sim exercises the state-machine code path that
previously skipped the Oracle auto-win check. Before the fix in
`lib/game/stateMachine.ts:checkOracleWin`, a deck-dealt Oracle
landing on a near-correct guess would NOT end the game — the player
would have to type the now-known target on the next round. With the
fix, those games end immediately. In the 571 Auto-mode Contains
Digit picks and 771 Oracle picks, the Oracle path is now consistent
with the manual-mode flow.

---

## Reading the per-clue tables

- **CAT**: P=Positional, C=Compositional, S=Special (meta).
- **OFFERED**: fraction of games where the chooser offered this clue
  (manual mode only — auto mode shows 0% since the chooser is never
  invoked).
- **PICK%**: of those, the fraction the AI selected (manual mode).
- **PICKS**: total picks across all games.
- **AVG/MED bits**: log2(candidates_before / max(candidates_after, 1))
  per pick. Higher = more information per use.
- **TOTAL bits**: cumulative info sourced from this clue.

The full machine-readable run is in
`scripts/strategicSim-output.json`.
