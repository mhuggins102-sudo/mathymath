# mathymath Simulation Report

**Run**: N=2000 per configuration, 5-digit, budget = 7 guesses (matches
the live game).
**Date**: 2026-05-20.
**Configurations**:
- Regular ("Easy") + manual clue selection
- Regular ("Easy") + auto (preselected) clue selection
- Advanced ("Hard") + manual clue selection
- Advanced ("Hard") + auto (preselected) clue selection

**AIs**:
- **Strategic** — uses locks, redraws, Clue Reuse with cost, category
  bias. Drives the real `lib/game/stateMachine.ts` reducer. Starts
  with 1 lock in Regular, 0 in Hard. See `scripts/strategicAI.ts`.
- **Baseline (greedy info-gain)** — picks the higher-information clue
  every round. **Now respects the live game's Clue Reuse lock cost**:
  Clue Reuse is unaffordable (and effectively disabled) when the lock
  budget can't cover it. Tracks bonus-lock-clue gains the same way
  the real game does. Otherwise no lock placement, no redraw strategy.
  See `scripts/sim.test.ts`.

> Re-run: `pnpm sim:strategic` (4 configs, writes
> `scripts/strategicSim-output.json`) and `pnpm sim` (baseline, Regular
> manual only).
> The starred (curated) round-1 set is now Bullseye, Sum Δ, Parity,
> Total Deviation, Higher or Lower, Within 2, Oracle, Thermometer.

---

## Strategy implemented

The strategic AI layers three concrete decisions on top of the greedy
info-gain core:

1. **Lock placement** (before each submit). When one digit covers ≥
   **60%** of remaining candidates at a slot, the AI places a lock
   there. Correct locks are refunded, so high-confidence locks are
   nearly free.
2. **Redraw decision** (manual mode only). If both offered clues
   yield < **1 bit** AND the lock budget can absorb the cost +
   safety lock, burn one lock to redraw. Capped at 2 redraws / game.
3. **Category-aware tiebreaker** on near-ties (within 0.5 bits):
   positional in rounds 1–3, compositional in 4+.

Clue Reuse carries a 0.5-bit equivalent lock-cost penalty in the
strategic chooser scoring.

### Lock accounting (matches `lib/game/locks.ts`)

Both AIs track the same budget formula:

```
budget = INITIAL_LOCKS                  (1 in Regular, 0 in Hard)
       + bonusLocksGained               (+1 per distinctDigits,
                                         upsAndDowns, divisibleBy,
                                         or legacy extraLock)
       − incorrectLocksUsed             (−1 per wrong lock)
       − redraws                        (−1 each)
       − clueReusePicks × CLUE_REUSE_COST   (−1 each)
```

Correct locks are not spent. The greedy baseline previously got Clue
Reuse "for free" — that's now fixed: when budget can't cover the
cost, Clue Reuse is scored as no-info so the chooser passes on it,
matching the live game's disabled-card behavior.

---

## Headline: all four configurations side by side

| Config | Win rate | Mean guesses (wins) | Losses |
|---|---:|---:|---:|
| Regular + Manual | **89.5%** | 5.59 | 211 |
| Regular + Auto   | 47.0% | 5.77 | 1059 |
| Hard + Manual    | **87.8%** | 5.67 | 243 |
| Hard + Auto      | 39.6% | 5.91 | 1209 |
| _Baseline (Regular + Manual, greedy w/ Clue Reuse cost)_ | _90.0%_ | _5.60_ | _200_ |

**Observations**:
- The **Hard penalty is small in manual mode** (−1.7 pp win rate,
  +0.08 guesses on win). Hard's signature handicaps — 0 starting
  locks, no Clue Reuse, no curated guarantee — bite at the margin
  but don't dramatically shift the win distribution.
- **Auto mode is much more punishing**, regardless of difficulty
  (−42 to −48 pp). Without a chooser, deck variance dominates
  outcomes.
- **Hard + Auto is the hardest config** at 39.6% win rate / 60.5%
  losses — 0 starting locks AND no chooser AND no Clue Reuse.

---

## Configuration 1: 5-digit Regular + Manual

```
win rate: 89.5%   mean (wins): 5.59

  1:     0    0.0%
  2:     4    0.2%
  3:    39    1.9%  ███
  4:   234   11.7%  ████████████████
  5:   523   26.2%  ███████████████████████████████████
  6:   590   29.5%  ████████████████████████████████████████
  7:   399   20.0%  ███████████████████████████
  ✕:   211   10.5%  ██████████████
```

### Per-clue ranking (manual + Regular)

⭐ = currently curated in `ROUND1_CURATED_CLUE_IDS`.

| Rank | Clue | Cat | Curated | Offered | Pick% | Picks | Avg bits |
|---:|---|:-:|:-:|---:|---:|---:|---:|
| 1 | Thermometer | P | ⭐ | 56% | 91.9% | 1038 | **5.58** |
| 2 | Odd or Even | P | ⭐ | 55% | 80.7% | 880 | 3.91 |
| 3 | Within 2 | P | ⭐ | 54% | 67.9% | 726 | 3.91 |
| 4 | Digit Sum (Sum Δ) | C | ⭐ | 57% | 64.1% | 726 | 3.64 |
| 5 | Total Deviation | C | ⭐ | 54% | 78.2% | 847 | 3.49 |
| 6 | Oracle | P | ⭐ | 57% | 77.0% | 872 | 3.48 |
| 7 | Clue Reuse | S | — (meta) | 47% | 44.4% | 420 | 3.41 |
| 8 | Higher or Lower | P | ⭐ | 55% | 77.0% | 847 | 3.15 |
| 9 | Contains Digit | C | — | 52% | 2.4% | 25 | 3.00 |
| 10 | Bullseye | P | ⭐ | 55% | 65.0% | 715 | 2.74 |
| 11 | Digit Overlap | C | — | 50% | 48.0% | 479 | 2.51 |
| 12 | Digit Class | C | — | 55% | 39.7% | 439 | 2.32 |
| 13 | Elimination | C | — | 54% | 36.4% | 389 | 2.10 |
| 14 | Stat Summary | C | — | 53% | 24.6% | 259 | 1.77 |
| 15 | Divisible By | C | — (bonus) | 53% | 20.1% | 213 | 1.46 |
| 16 | Bullseye Trend | C | — (R1-ineligible) | 47% | 30.9% | 288 | 1.40 |
| 17 | Distinct Digits | C | — (bonus) | 53% | 21.4% | 228 | 1.19 |
| 18 | Ups and Downs | C | — (bonus) | 54% | 13.0% | 140 | 0.89 |

**The new curated set holds up well**: 7 of the top 8 clues are
starred (only Clue Reuse intrudes — and it's a meta card that needs
prior history). The newly-promoted **Digit Sum (#4)** and **Bullseye
(#10)** both rank above the previously-starred Digit Overlap (#11)
and Elimination (#13).

### Lock economy

```
locks placed     : 617   (avg 0.31 / game)
locks correct    : 415   (67.3% hit rate)
redraws          : 58    (avg 0.03 / game)
clue reuse picks : 420   (avg 0.21 / game) — all paid 1 lock
```

---

## Configuration 2: 5-digit Regular + Auto

```
win rate: 47.0%   mean (wins): 5.77

  1:     0    0.0%
  2:     4    0.2%
  3:    17    0.9%  █
  4:   103    5.1%  ████
  5:   224   11.2%  ████████
  6:   308   15.4%  ████████████
  7:   285   14.2%  ███████████
  ✕:  1059   52.9%  ████████████████████████████████████████
```

### Per-clue ranking (Auto + Regular)

| Rank | Clue | Cat | Picks | Avg bits |
|---:|---|:-:|---:|---:|
| 1 | Contains Digit | C | 532 | **7.73** |
| 2 | Thermometer | P | 752 | 5.41 |
| 3 | Odd or Even | P | 721 | 3.60 |
| 4 | Total Deviation | C | 713 | 3.46 |
| 5 | Oracle | P | 728 | 3.38 |
| 6 | Within 2 | P | 704 | 3.25 |
| 7 | Digit Sum | C | 766 | 3.19 |
| 8 | Higher or Lower | P | 733 | 3.13 |
| 9 | Bullseye | P | 737 | 2.34 |
| 10 | Digit Overlap | C | 560 | 2.03 |
| 11 | Elimination | C | 573 | 1.88 |
| 12 | Digit Class | C | 541 | 1.86 |
| 13 | Stat Summary | C | 561 | 1.22 |
| 14 | Bullseye Trend | C | 539 | 1.10 |
| 15 | Divisible By | C | 565 | 1.09 |
| 16 | Distinct Digits | C | 590 | 1.09 |
| 17 | Ups and Downs | C | 553 | 0.65 |

Contains Digit again dominates when the AI drives the multi-pick
freely (no chooser tax). Without a chooser, deck variance is the
biggest driver — a string of low-info bottom-tier clues exhausts
the budget before the candidate set narrows.

### Lock economy

```
locks placed     : 651   (avg 0.33 / game)
locks correct    : 419   (64.4% hit rate)
redraws          : 0     (no chooser → can't redraw)
clue reuse picks : 0     (Clue Reuse not in Auto decks)
```

---

## Configuration 3: 5-digit Hard + Manual

```
win rate: 87.8%   mean (wins): 5.67

  1:     0    0.0%
  2:     5    0.3%
  3:    31    1.6%  ██
  4:   183    9.2%  ████████████
  5:   501   25.1%  ████████████████████████████████
  6:   632   31.6%  ████████████████████████████████████████
  7:   405   20.3%  ██████████████████████████
  ✕:   243   12.2%  ███████████████
```

**Hard mode is barely harder than Regular in manual.** Only −1.7 pp
win rate vs Regular + Manual. The 0-locks-to-start and no-Clue-Reuse
penalties hurt at the margin but the chooser still saves most
games.

### Per-clue ranking (Manual + Hard)

| Rank | Clue | Cat | Curated | Offered | Pick% | Picks | Avg bits |
|---:|---|:-:|:-:|---:|---:|---:|---:|
| 1 | Thermometer | P | ⭐ | 61% | 92.9% | 1141 | **5.52** |
| 2 | Within 2 | P | ⭐ | 60% | 67.5% | 813 | 3.93 |
| 3 | Odd or Even | P | ⭐ | 63% | 77.3% | 972 | 3.93 |
| 4 | Digit Sum | C | ⭐ | 57% | 58.1% | 668 | 3.52 |
| 5 | Oracle | P | ⭐ | 59% | 70.7% | 834 | 3.50 |
| 6 | Higher or Lower | P | ⭐ | 56% | 68.2% | 764 | 3.39 |
| 7 | Total Deviation | C | ⭐ | 58% | 68.0% | 789 | 3.23 |
| 8 | Bullseye | P | ⭐ | 57% | 55.3% | 631 | 2.76 |
| 9 | Digit Overlap | C | — | 58% | 56.5% | 655 | 2.55 |
| 10 | Digit Class | C | — | 54% | 47.5% | 514 | 2.55 |
| 11 | Contains Digit | C | — | 58% | 2.3% | 27 | 2.43 |
| 12 | Elimination | C | — | 56% | 46.3% | 516 | 2.14 |
| 13 | Stat Summary | C | — | 58% | 29.4% | 339 | 1.55 |
| 14 | Bullseye Trend | C | — | 51% | 30.2% | 306 | 1.48 |
| 15 | Divisible By | C | — (bonus) | 56% | 24.1% | 268 | 1.44 |
| 16 | Distinct Digits | C | — (bonus) | 54% | 26.7% | 289 | 1.27 |
| 17 | Ups and Downs | C | — (bonus) | 56% | 16.3% | 182 | 0.89 |

**No Clue Reuse in this deck** (per `clueSelector.ts:81`), so the
table is one row shorter and the offered % for every regular clue is
slightly higher (its slot in the deck is no longer competing with the
specials).

### Lock economy (Hard + Manual)

```
locks placed     : 226   (avg 0.11 / game)
locks correct    : 162   (71.7% hit rate)
redraws          : 5     (avg 0.003 / game)
clue reuse picks : 0     (not in deck)
```

Hard mode placed about **a third as many locks** as Regular (0.11 vs
0.31 per game). With 0 starting locks, the AI has to wait for a
bonus-lock clue (distinctDigits / upsAndDowns / divisibleBy) before
it can lock anything. The 71.7% hit rate is the highest of the four
configs — when the AI does spend a hard-won lock, it picks carefully.

---

## Configuration 4: 5-digit Hard + Auto

```
win rate: 39.6%   mean (wins): 5.91

  1:     0    0.0%
  2:     0    0.0%
  3:    18    0.9%  █
  4:    68    3.4%  ██
  5:   154    7.7%  █████
  6:   275   13.8%  █████████
  7:   276   13.8%  █████████
  ✕:  1209   60.5%  ████████████████████████████████████████
```

**The hardest configuration on offer.** 60.5% loss rate. The
combination of 0 starting locks, no chooser, no Clue Reuse, and no
curated round-1 guarantee means the deck variance is the entire
game.

### Per-clue ranking (Auto + Hard)

| Rank | Clue | Cat | Picks | Avg bits |
|---:|---|:-:|---:|---:|
| 1 | Contains Digit | C | 654 | **10.41** |
| 2 | Thermometer | P | 675 | 4.90 |
| 3 | Odd or Even | P | 652 | 3.28 |
| 4 | Oracle | P | 654 | 3.08 |
| 5 | Total Deviation | C | 673 | 3.08 |
| 6 | Within 2 | P | 664 | 3.04 |
| 7 | Higher or Lower | P | 648 | 2.78 |
| 8 | Digit Sum | C | 683 | 2.75 |
| 9 | Bullseye | P | 685 | 2.23 |
| 10 | Digit Overlap | C | 668 | 2.20 |
| 11 | Digit Class | C | 690 | 2.06 |
| 12 | Elimination | C | 636 | 1.73 |
| 13 | Stat Summary | C | 629 | 1.10 |
| 14 | Distinct Digits | C | 639 | 1.07 |
| 15 | Divisible By | C | 602 | 1.04 |
| 16 | Bullseye Trend | C | 638 | 1.03 |
| 17 | Ups and Downs | C | 672 | 0.46 |

Contains Digit hits a startling **10.41 avg bits/pick** in Hard +
Auto. With no curated round-1 floor, the deck more frequently lands
Contains Digit on round 1 where the candidate set is huge — and a
5-pick channel reaps maximum bits.

### Lock economy (Hard + Auto)

```
locks placed     : 349   (avg 0.17 / game)
locks correct    : 239   (68.5% hit rate)
redraws          : 0     (can't redraw in auto)
clue reuse picks : 0     (not in hard deck)
```

---

## Strategy gap: average vs optimal (Regular + Manual)

Comparing the **baseline greedy AI** (now spending a lock on every
Clue Reuse pick) against the **strategic AI** (locks, redraws, Clue
Reuse with cost), both Regular + Manual at N=2000, budget=7:

| Metric | Baseline (avg) | Strategic | Δ |
|---|---:|---:|---:|
| Win rate | 90.0% | 89.5% | **−0.5 pp** |
| Mean guesses on win | 5.60 | 5.59 | **−0.01** |
| Losses | 200 | 211 | +11 |
| Clue Reuse pick rate | 64.4% | 44.4% | −20.0 |
| Locks placed | 0 | 617 | +617 |
| Redraws | 0 | 58 | +58 |

**The gap closed once the baseline started paying for Clue Reuse.**
Previously the baseline got the meta card "for free" and edged out
strategic by 1.1 pp. With the cost properly modeled, the two AIs sit
within **0.5 pp** of each other — a genuine apples-to-apples
comparison.

### What this means for the strategy gap

The remaining 0.5-pp baseline edge isn't real "average-is-better"
signal. The strategic AI's redraw heuristic (1-bit floor) and 60%
lock-confidence threshold cost a few locks on edge cases. Two
adjustments would close the gap:

- **Higher lock-confidence threshold** (e.g. 70%): 67% of strategic
  locks land correct currently. Pushing the threshold up would trade
  ~5% of the locks for tighter accuracy.
- **Tighter redraw floor** (e.g. 0.7 bits instead of 1.0): the AI
  burns 0.03 locks/game on marginal redraws that often don't pay off.

The bigger truth still holds: **strategy is a small lever in this
game**. The chooser does most of the work; the lock economy is
fairly priced; the curated round-1 set anchors most games to a
reasonable opener.

---

## Hard vs Regular: what the difficulty toggle actually changes

The strategic-AI numbers let us measure the real handicap of Hard
mode by configuration:

| | Regular | Hard | Δ |
|---|---:|---:|---:|
| Manual win rate | 89.5% | 87.8% | **−1.7 pp** |
| Auto win rate | 47.0% | 39.6% | **−7.4 pp** |
| Manual mean guesses | 5.59 | 5.67 | +0.08 |
| Locks placed (manual) | 617 | 226 | −63% |

In manual mode the chooser absorbs most of the Hard penalty —
players still get to skip past weak clues, even without Clue Reuse.
The damage is much bigger in Auto mode, where Hard's 0-starting-
locks bite directly: the AI can't lock anything until a bonus-lock
clue appears in the deck.

**Design takeaway**: Hard's signature is more about taking away the
*meta levers* (Clue Reuse, starting locks) than making each round
mechanically harder. In manual mode that's a graceful difficulty
bump; in auto mode it stacks with the deck-variance penalty.

---

## Reading the per-clue tables

- **CAT**: P=Positional, C=Compositional, S=Special (meta).
- **OFFERED**: fraction of games where the chooser offered this clue
  (manual modes only — Auto shows 0% since the chooser is never
  invoked; **PICKS** is the meaningful column there).
- **PICK%**: of those offered, the fraction the AI selected (manual).
- **AVG/MED bits**: log2(candidates_before / max(candidates_after, 1))
  per pick. Higher = more info per use.
- **TOTAL bits**: cumulative info from this clue across the run.

Full machine-readable run in `scripts/strategicSim-output.json`.
