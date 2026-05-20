# mathymath Simulation Report

**Run**: N=2000 per configuration, 5-digit, Regular ("Easy") mode, budget = 8 guesses.
**Date**: 2026-05-20.
**AIs**:
- **Strategic** (this run) — locks, redraws, Clue Reuse with cost,
  category bias. See `scripts/strategicAI.ts`.
- **Baseline (greedy info-gain)** — picks the higher-info clue every
  round; never spends locks; treats Clue Reuse as if it were free.
  See `scripts/sim.test.ts`. Stands in for "average player who picks
  reasonably but doesn't fully exercise the lock economy."

> Re-run: `pnpm sim:strategic` (writes
> `scripts/strategicSim-output.json` + console tables) and `pnpm sim`
> (baseline tables to console).

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

---

## Configuration: 5-digit Regular, MANUAL clue selection

### Histogram (guesses to win; ✕ = lost)

```
win rate: 96.9%   mean (wins): 5.87

  1:     1    0.1%
  2:     0    0.0%
  3:    33    1.7%  ██
  4:   208   10.4%  █████████████
  5:   485   24.3%  ██████████████████████████████
  6:   638   31.9%  ████████████████████████████████████████
  7:   397   19.9%  █████████████████████████
  8:   176    8.8%  ███████████
  ✕:    62    3.1%  ████
```

The modal win is **6 guesses**, with a long tail; ~25% of games take
5 or fewer.

### Clue utility — ranked by avg bits/pick

| Rank | Clue | Cat | Offered | Pick% | Picks | Avg bits | Med bits | Total bits |
|---:|---|:-:|---:|---:|---:|---:|---:|---:|
| 1 | Thermometer | P | 60% | 91.1% | 1093 | **5.46** | 5.64 | 5972 |
| 2 | Within 2 | P | 56% | 66.6% | 751 | 3.99 | 4.15 | 2993 |
| 3 | Odd or Even (Parity) | P | 57% | 80.6% | 926 | 3.88 | 4.14 | 3597 |
| 4 | Oracle | P | 56% | 74.6% | 840 | 3.52 | 3.51 | 2956 |
| 5 | Digit Sum (Sum Δ) | C | 56% | 53.8% | 600 | 3.40 | 3.53 | 2038 |
| 6 | Clue Reuse | S | 50% | 45.2% | 452 | 3.38 | 3.17 | 1526 |
| 7 | Total Deviation | C | 55% | 71.8% | 791 | 3.33 | 3.35 | 2635 |
| 8 | Higher or Lower | P | 58% | 74.0% | 860 | 3.26 | 3.17 | 2803 |
| 9 | Bullseye | P | 56% | 51.4% | 579 | 2.81 | 2.70 | 1626 |
| 10 | Digit Overlap | C | 53% | 66.3% | 707 | 2.48 | 2.28 | 1754 |
| 11 | Contains Digit | C | 55% | 2.6% | 29 | 2.39 | 2.00 | 69 |
| 12 | Digit Class | C | 55% | 42.0% | 459 | 2.36 | 2.00 | 1084 |
| 13 | Elimination | C | 56% | 52.8% | 586 | 2.07 | 1.93 | 1215 |
| 14 | Stat Summary | C | 56% | 23.8% | 269 | 1.53 | 1.28 | 413 |
| 15 | Divisible By | C | 56% | 26.3% | 292 | 1.36 | 1.15 | 398 |
| 16 | Bullseye Trend | C | 50% | 30.6% | 303 | 1.33 | 1.18 | 404 |
| 17 | Distinct Digits | C | 58% | 19.2% | 223 | 1.14 | 1.00 | 254 |
| 18 | Ups and Downs | C | 55% | 13.7% | 151 | 0.84 | 0.74 | 127 |

**Top tier (≥3.5 avg bits)**: Thermometer, Within 2, Parity, Oracle.
All positional. Thermometer is a clear standout — its 3-tier reveal
across every slot consistently halves and halves the candidate set
again per pick.

**Mid tier (2.0-3.5 bits)**: Sum Δ, Total Deviation, Higher/Lower,
Bullseye, Digit Overlap, Contains Digit, Digit Class, Elimination,
Clue Reuse. Mixed positional/compositional. Clue Reuse sits squarely
here because the strategic AI re-applies whichever prior clue scores
best, and Thermometer/Oracle are the usual targets.

**Bottom tier (<2 bits)**: Stat Summary, Divisible By, Bullseye Trend,
Distinct Digits, Ups and Downs. Compositional clues that report a
narrow categorical signal. They're useful as supporting evidence but
rarely shift the candidate distribution by more than 1-2 bits.

The very low Contains Digit **pick rate** (2.6%) does NOT reflect low
information — it reflects the multi-pick UI. The chooser sees Contains
Digit as a single round but it costs the player multiple clicks; the
strategic AI's per-pick info-gain heuristic understates its value (the
auto-mode column below picks it up correctly).

### Lock economy

```
locks placed     : 641   (avg 0.32/game)
locks correct    : 455   (71.0% hit rate)
redraws          : 77    (avg 0.04/game)
clue reuse picks : 452   (avg 0.23/game)
```

The AI rarely locks (≤1 every three games) and almost never redraws
(≤1 every 25 games). When it does lock, it's right 71% of the time
— the 60% confidence threshold buys ~10 pp of margin against random
slot guessing.

---

## Configuration: 5-digit Regular, AUTO clue selection

In Auto mode the deck is pre-dealt at game start and there is no
chooser. The AI's only strategic levers are **lock placement** (same
heuristic as manual) and how to drive Contains Digit's multi-pick
(left-to-right). All clues appear at their deck-distribution rate;
the per-clue **OFFERED/PICK%** column reads as 0% because no chooser
is invoked — the **PICKS** column is the meaningful one.

### Histogram (guesses to win; ✕ = lost)

```
win rate: 54.4%   mean (wins): 6.20

  1:     1    0.1%
  2:     1    0.1%
  3:    23    1.1%  █
  4:   101    5.1%  ████
  5:   191    9.6%  ████████
  6:   288   14.4%  █████████████
  7:   274   13.7%  ████████████
  8:   210   10.5%  █████████
  ✕:   911   45.6%  ████████████████████████████████████████
```

**Almost half of Auto-mode games are losses.** The win-or-lose split
is closer to coin flip than the manual mode's 97% win rate. Without
the ability to skip past a weak clue, the AI is at the mercy of the
deck — a few low-information cards in a row exhaust the budget
before the candidate set narrows enough to commit a guess.

### Clue utility — ranked by avg bits/pick (Auto)

| Rank | Clue | Cat | Picks | Avg bits | Med bits | Total bits |
|---:|---|:-:|---:|---:|---:|---:|
| 1 | Contains Digit | C | 622 | **7.80** | 7.71 | 4852 |
| 2 | Thermometer | P | 819 | 5.02 | 5.62 | 4113 |
| 3 | Odd or Even | P | 835 | 3.37 | 4.00 | 2816 |
| 4 | Within 2 | P | 802 | 3.30 | 3.61 | 2645 |
| 5 | Oracle | P | 831 | 3.16 | 3.47 | 2628 |
| 6 | Total Deviation | C | 802 | 3.14 | 3.63 | 2516 |
| 7 | Higher or Lower | P | 809 | 2.78 | 2.70 | 2250 |
| 8 | Bullseye | P | 634 | 2.35 | 2.05 | 1493 |
| 9 | Digit Overlap | C | 776 | 2.14 | 2.28 | 1658 |
| 10 | Digit Sum | C | 632 | 2.05 | 2.09 | 1298 |
| 11 | Digit Class | C | 628 | 1.74 | 1.54 | 1096 |
| 12 | Elimination | C | 796 | 1.71 | 1.86 | 1359 |
| 13 | Stat Summary | C | 633 | 1.08 | 0.67 | 686 |
| 14 | Divisible By | C | 631 | 1.05 | 0.88 | 660 |
| 15 | Bullseye Trend | C | 609 | 0.98 | 0.88 | 594 |
| 16 | Distinct Digits | C | 606 | 0.89 | 0.91 | 542 |
| 17 | Ups and Downs | C | 616 | 0.58 | 0.10 | 355 |

The **Contains Digit** number is the most striking result in the
report: when the AI is allowed to drive the multi-pick freely, it
extracts ~7.8 bits of information per round — more than any other
clue, more than 1.5x Thermometer. This is consistent with how
Contains Digit works: each slot pick is itself an independent
information channel, and a 5-digit guess can yield up to 5 channels
of green/yellow/red per round. The manual-mode tax (2.6% pick rate,
2.39 bits/pick) reflects player friction with the multi-pick UI, not
the clue's actual power.

The bottom-tier ordering matches manual mode closely: Stat Summary,
Divisible By, Bullseye Trend, Distinct Digits, Ups and Downs all sit
≤ 1.1 bits/pick. In Auto mode where you can't skip them, they're the
deck cards that drive the 45.6% loss rate.

### Lock economy (Auto)

```
locks placed     : 703   (avg 0.35/game)
locks correct    : 492   (70.0% hit rate)
redraws          : 0     (no chooser, can't redraw)
clue reuse picks : 0     (Clue Reuse not in preselected decks)
```

Same lock-placement heuristic as manual; ~70% hit rate. Without
redraws or Clue Reuse, locks are the AI's only lever — and a single
lever isn't enough to overcome a poor deck.

---

## Strategy gap: average vs optimal

Comparing the **baseline greedy AI** (no locks/redraws, free Clue
Reuse) against the **strategic AI** (locks, redraws, Clue Reuse with
cost), both manual-mode at N=2000:

| Metric | Baseline (avg) | Strategic | Δ |
|---|---:|---:|---:|
| Win rate | 98.0% | 96.9% | **−1.1 pp** |
| Mean guesses on win | 5.90 | 5.87 | **−0.03** |
| Losses | 39 | 62 | +23 |
| Clue Reuse picks | 634 | 452 | −182 |

**The gap is small — and the strategic AI is actually slightly
worse on win rate.** Three things going on:

1. The baseline AI gets Clue Reuse "for free" (it doesn't model the
   lock cost). In reality Clue Reuse always costs a lock, so the
   baseline understates the cost of its own play. A real average
   player WOULD pay this cost and probably score below the baseline.

2. The strategic AI's lock placement spends some locks incorrectly
   (29% wrong-lock rate at the 60% confidence threshold). That puts
   it in tighter spots on hard puzzles where the baseline (which
   never locks) coasts through.

3. The strategic AI wins slightly **faster** when it wins (−0.03
   mean guesses), but the speedup is small. Information-gain ceiling
   is set by the clues themselves, and the gap between greedy and
   strategic is bounded by what the lock economy can buy in 7-8
   rounds.

**What this means for design**: the gap from average to optimal play
is small in this game (≤ ~1 percentage point of win rate, fraction
of a guess on average). The lock economy is fairly priced — a player
who never uses locks isn't much worse than one who uses them
optimally, and overusing locks is genuinely punishing.

A more careful strategic AI would tune the lock-confidence threshold
upward (say to 70-75%) to trade a few rare wins for fewer rare losses.
The current AI is a reasonable approximation of strong-but-not-perfect
play; the absolute optimal would close most of the 23-game gap to
baseline (and likely beat it).

---

## Strategic vs baseline — per-clue head-to-head

The strategic AI's category bias and Clue Reuse penalty change the
distribution of picks. Notable shifts (manual mode):

| Clue | Strategic Pick% | Baseline Pick% | Δ |
|---|---:|---:|---:|
| Thermometer | 91.1% | 93.1% | −2.0 |
| Odd or Even | 80.6% | 83.4% | −2.8 |
| Oracle | 74.6% | 71.8% | +2.8 |
| Higher or Lower | 74.0% | 71.3% | +2.7 |
| Clue Reuse | 45.2% | 63.8% | **−18.6** |
| Bullseye | 51.4% | 46.1% | +5.3 |
| Digit Sum | 53.8% | 58.8% | −5.0 |

The strategic AI's Clue Reuse penalty is the biggest behavioral
delta — −18.6 percentage points on the Clue Reuse pick rate. That
matches the underlying claim: when the baseline picks Clue Reuse
~64% of the time it's offered, it's not really paying for it; the
strategic AI passes more often because the lock cost is real.

---

## Notes on the Oracle bug-fix exercise

The Auto-mode sim exercises the state-machine code path that
previously skipped the Oracle auto-win check. Before the fix in
`lib/game/stateMachine.ts:checkOracleWin`, a deck-dealt Oracle
landing on a near-correct guess would NOT end the game — the player
would have to type the now-known target on the next round. With the
fix, those games end immediately. In the 622 Auto-mode Contains
Digit picks and 831 Oracle picks, the Oracle path is now consistent
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
