/**
 * Strategic AI for sims.
 *
 * Extends the greedy info-gain core (see scripts/lib/simEngine.ts) with
 * three concrete strategy layers that target the gap between an average
 * player and an optimal one:
 *
 *  1. **Lock placement** before each submit. The AI inspects the
 *     remaining candidate set's per-slot digit distribution. When a
 *     single digit covers ≥ LOCK_CONFIDENCE of candidates at a slot,
 *     it places a lock there. Correct locks are refunded by the lock
 *     economy, so a high-confidence lock is nearly free; a wrong lock
 *     burns one budget point. The threshold biases conservative.
 *
 *  2. **Redraw decision** before clue scoring (manual mode only). If
 *     both offered clues are weak (max information gain below
 *     REDRAW_INFO_FLOOR bits) AND the lock budget can absorb both the
 *     redraw cost AND a follow-up safety lock, the AI burns one lock
 *     to draw a fresh pair. Capped at MAX_REDRAWS_PER_GAME to keep
 *     pathological games from spending the entire budget here.
 *
 *  3. **Category-aware tiebreaker**. The greedy core picks the
 *     lower-expected-remaining clue; on near-ties (within
 *     CATEGORY_TIE_BAND bits), the AI prefers positional clues in
 *     early rounds (when slot reveals compound) and compositional
 *     clues in late rounds (when narrowing a small candidate set
 *     benefits from whole-number constraints).
 *
 * Clue Reuse falls out of the existing scoreClueReuse heuristic, with
 * the lock cost folded into the decision via a small avgBits-equivalent
 * penalty (REUSE_LOCK_PENALTY) so it's only picked when the info gain
 * materially beats the alternative.
 *
 * Mode: "manual" runs the chooser path (pickTwoClues per round, with
 * optional redraws). "auto" runs the preselected-deck path — the AI's
 * only strategic lever is lock placement.
 */
import {
  type GameState,
  initGameState,
  reduce,
} from "@/lib/game/stateMachine";
import { knownSlotsFromHistory } from "@/lib/game/certain";
import type { Clue, ClueId, ClueResult } from "@/lib/game/clues/types";
import {
  allCandidates,
  buildContext,
  expectedRemainingForClue,
  filterByResult,
  scoreClueReuse,
  slotDigitDistribution,
  topDigitForSlot,
  type SimHistoryEntry,
} from "./lib/simEngine";

// ---------------------------------------------------------------------------
// Strategy tuning knobs. Hand-tuned on a 200-game pilot pre-flight; the
// 2000-game sim is the actual evaluation.
// ---------------------------------------------------------------------------

const LOCK_CONFIDENCE = 0.6;
/** Skip locks once the remaining pool is this small — the win is one
 *  guess away anyway and a wrong lock just wastes budget. */
const LOCK_SKIP_BELOW_CANDIDATES = 3;
/** Bits of information considered "weak enough to redraw past". 1 bit
 *  ≈ a clue that halves the candidate set on average — anything below
 *  that is barely better than guessing again. */
const REDRAW_INFO_FLOOR = 1.0;
const MAX_REDRAWS_PER_GAME = 2;
/** Category preference operates only on near-ties to avoid overriding
 *  the info-gain signal when it's clearly pointing one way. */
const CATEGORY_TIE_BAND = 0.5;
/** Equivalent-bits penalty applied to Clue Reuse score so the lock
 *  cost shows up in the decision. */
const REUSE_LOCK_PENALTY_BITS = 0.5;

// ---------------------------------------------------------------------------
// Stats & game shape
// ---------------------------------------------------------------------------

export interface GameStats {
  won: boolean;
  guessCount: number;
  cluePicks: ClueId[];
  /** Locks the AI attempted, with per-slot correctness. */
  locks: { slot: number; digit: string; correct: boolean }[];
  /** Total redraws (manual mode only). */
  redraws: number;
  /** Clue Reuse picks (subset of cluePicks for convenience). */
  clueReusePicks: number;
  /** Pair-1 category distribution; null in auto mode. */
  pair1Categories:
    | ["positional" | "compositional" | "special", "positional" | "compositional" | "special"]
    | null;
  pair1PickedCategory: "positional" | "compositional" | "special" | null;
  offeredIds: Set<ClueId>;
  /** Per-round decisions for downstream analysis. */
  decisions: DecisionRecord[];
  /** Locks remaining at end of game (correct locks didn't spend budget). */
  locksRemaining: number;
  /** What underlying clue each clueReuse pick re-applied. */
  reuseAppliedTo: ClueId[];
}

export interface DecisionRecord {
  round: number;
  pickedId: ClueId;
  otherId: ClueId | null;
  pickedReusedId?: ClueId;
  pickedExp: number;
  otherExp: number | null;
  bitsGained: number;
  candidatesBefore: number;
  candidatesAfter: number;
  /** Whether the round opened with one or more redraws. */
  redrawsThisRound: number;
}

export interface PlayConfig {
  target: string;
  seed: string;
  digits: number;
  budget: number;
  mode: "manual" | "auto";
  /** Pre-built candidate pool. Pass in to avoid recomputing per game. */
  candidates: string[];
  /** "Hard" rules: full deck shuffle, 0 starting locks, no Clue Reuse,
   *  no curated round-1 guarantee. Mirrors the live game's hard mode. */
  advancedMode?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const META_CLUE_IDS: ReadonlySet<ClueId> = new Set<ClueId>([
  "extraLock",
  "clueReuse",
]);

/** Decide which slots to lock on this submit. Returns the lock attempts
 *  list (resolved correctness happens inside SUBMIT_GUESS). Honors the
 *  AI's remaining-lock budget. */
function planLocks(
  candidates: readonly string[],
  guess: string,
  digits: number,
  locksAvailable: number,
  alreadyKnownSlots: ReadonlySet<number>,
): { slot: number; digit: string }[] {
  if (locksAvailable <= 0) return [];
  if (candidates.length < LOCK_SKIP_BELOW_CANDIDATES) return [];
  const dist = slotDigitDistribution(candidates, digits);
  type Candidate = { slot: number; digit: number; fraction: number };
  const ranked: Candidate[] = [];
  for (let s = 0; s < digits; s++) {
    if (alreadyKnownSlots.has(s)) continue;
    // Don't lock against the guess if it's already on the candidate-
    // top digit — the strategic value comes from PINNING the top
    // digit, even if our guess happens to match it.
    const top = topDigitForSlot(dist[s], candidates.length);
    if (top.fraction >= LOCK_CONFIDENCE) {
      ranked.push({ slot: s, digit: top.digit, fraction: top.fraction });
    }
  }
  // Sort by confidence descending; take up to `locksAvailable`.
  ranked.sort((a, b) => b.fraction - a.fraction);
  const out: { slot: number; digit: string }[] = [];
  for (const r of ranked) {
    if (out.length >= locksAvailable) break;
    // Skip locking a digit the guess already shows at that slot — the
    // game still resolves it as correct (info-free), but it consumes
    // a lock slot from our budget pool with no upside.
    if (guess[r.slot] === String(r.digit)) continue;
    out.push({ slot: r.slot, digit: String(r.digit) });
  }
  return out;
}

/** Lower expected-remaining is better. Convert to bits-equivalent for
 *  cross-clue comparison: log2(N / max(exp, 1)). */
function expectedToBits(expectedRemaining: number, n: number): number {
  return Math.log2(Math.max(1, n) / Math.max(1, expectedRemaining));
}

/** Score the chooser's pair. Returns the picked clue plus diagnostic
 *  info for the decision record. */
function pickClueStrategic(
  options: readonly [Clue, Clue],
  candidates: readonly string[],
  guess: string,
  context: ReturnType<typeof buildContext>,
  priorPicks: readonly ClueId[],
  round: number,
): {
  pickedIdx: 0 | 1;
  pickedReusedId?: ClueId;
  pickedExp: number;
  otherExp: number;
} {
  const scoreFor = (idx: 0 | 1) => {
    const id = options[idx].id;
    if (id === "extraLock") {
      return { expectedRemaining: candidates.length };
    }
    if (id === "clueReuse") {
      const r = scoreClueReuse(candidates, guess, context, priorPicks);
      // Penalize Clue Reuse's score in bits to model the lock cost.
      // Convert penalty bits back to expected-remaining: a penalty of
      // p bits scales expectedRemaining by 2^p.
      const penalized =
        r.expectedRemaining * Math.pow(2, REUSE_LOCK_PENALTY_BITS);
      return {
        expectedRemaining: Math.min(penalized, candidates.length),
        reusedId: r.reusedId ?? undefined,
      };
    }
    return {
      expectedRemaining: expectedRemainingForClue(
        candidates,
        guess,
        id,
        context,
      ),
    };
  };

  const s0 = scoreFor(0);
  const s1 = scoreFor(1);

  // Convert to bits for the category-tiebreaker comparison.
  const n = candidates.length;
  const b0 = expectedToBits(s0.expectedRemaining, n);
  const b1 = expectedToBits(s1.expectedRemaining, n);
  let pickedIdx: 0 | 1 = b0 >= b1 ? 0 : 1;
  // Near-tie: apply category preference.
  if (Math.abs(b0 - b1) <= CATEGORY_TIE_BAND) {
    const earlyPhase = round <= 3;
    const c0 = options[0].category;
    const c1 = options[1].category;
    const preferred: Clue["category"] = earlyPhase ? "positional" : "compositional";
    if (c0 === preferred && c1 !== preferred) pickedIdx = 0;
    else if (c1 === preferred && c0 !== preferred) pickedIdx = 1;
  }

  const pickedScore = pickedIdx === 0 ? s0 : s1;
  const otherScore = pickedIdx === 0 ? s1 : s0;
  return {
    pickedIdx,
    pickedReusedId: (pickedScore as { reusedId?: ClueId }).reusedId,
    pickedExp: pickedScore.expectedRemaining,
    otherExp: otherScore.expectedRemaining,
  };
}

// ---------------------------------------------------------------------------
// Main entry: play one game
// ---------------------------------------------------------------------------

export function playStrategic(config: PlayConfig): GameStats {
  const {
    target,
    seed,
    digits,
    budget,
    mode,
    candidates: initialPool,
    advancedMode = false,
  } = config;
  let candidates = initialPool.slice();
  const history: SimHistoryEntry[] = [];

  let state: GameState = initGameState({
    target,
    seed,
    digits,
    maxGuesses: budget,
    advancedMode,
    preselectedClues: mode === "auto",
  });

  const stats: GameStats = {
    won: false,
    guessCount: 0,
    cluePicks: [],
    locks: [],
    redraws: 0,
    clueReusePicks: 0,
    pair1Categories: null,
    pair1PickedCategory: null,
    offeredIds: new Set(),
    decisions: [],
    locksRemaining: 0,
    reuseAppliedTo: [],
  };

  // Mirrors lib/game/locks.ts:initialLocksFor — Regular = 1, Hard = 0.
  let lockBudget = advancedMode ? 0 : 1;

  /** Record an applied clue: filter candidates, push history entry,
   *  generate a decision record. Centralized so the auto-resolve and
   *  manual-choose paths produce identical bookkeeping. */
  const recordApplied = (
    appliedClueId: ClueId,
    result: ClueResult,
    guess: string,
    pickedId: ClueId,
    otherId: ClueId | null,
    pickedExp: number,
    otherExp: number | null,
    redrawsThisRound: number,
    pickedReusedId: ClueId | undefined,
    contextBefore: ReturnType<typeof buildContext>,
  ) => {
    const before = candidates.length;
    candidates = filterByResult(
      candidates,
      guess,
      appliedClueId,
      result,
      contextBefore,
    );
    const after = candidates.length;
    history.push({ guess, clueId: appliedClueId, result });
    stats.cluePicks.push(pickedId);
    stats.decisions.push({
      round: stats.decisions.length + 1,
      pickedId,
      otherId,
      pickedReusedId,
      pickedExp,
      otherExp,
      bitsGained: Math.log2(Math.max(1, before) / Math.max(1, after)),
      candidatesBefore: before,
      candidatesAfter: after,
      redrawsThisRound,
    });
    // Bonus-lock clues grant +1 lock.
    if (
      pickedId === "distinctDigits" ||
      pickedId === "divisibleBy" ||
      pickedId === "upsAndDowns" ||
      pickedId === "extraLock"
    ) {
      lockBudget += 1;
    }
  };

  while (state.status === "playing" && stats.guessCount < budget) {
    const guess = candidates[0] ?? initialPool[0];
    stats.guessCount += 1;

    const knownSlotsBefore = new Set(
      knownSlotsFromHistory(state.guesses, digits),
    );
    const lockAttempts = planLocks(
      candidates,
      guess,
      digits,
      lockBudget,
      knownSlotsBefore,
    );
    const ctxBefore = buildContext(history, digits);

    state = reduce(state, {
      type: "SUBMIT_GUESS",
      guess,
      locks: lockAttempts.length > 0 ? lockAttempts : undefined,
    });

    // Record any locks the reducer resolved (pending or final row).
    const pendingLocks = state.pendingGuess?.locks;
    const justResolvedLocks =
      !state.pendingGuess && state.guesses[state.guesses.length - 1]
        ? state.guesses[state.guesses.length - 1].locks
        : undefined;
    const lockListToRecord = pendingLocks ?? justResolvedLocks;
    if (lockListToRecord) {
      for (const l of lockListToRecord) {
        stats.locks.push({ ...l });
        if (!l.correct) lockBudget -= 1;
      }
    }

    if (state.status !== "playing") {
      // Record auto-mode terminal-row clue contributions for the per-
      // clue table — but skip exact-match wins. The reducer attaches
      // a placeholder "bullseyes" row on exact match (so the UI can
      // render the final green row), and counting that as a player
      // pick would inflate Bullseyes' stats; the player never chose
      // it. Loss rows have no clueId, so they're skipped naturally.
      const last = state.guesses[state.guesses.length - 1];
      const isExactMatchWin = guess === target;
      if (!isExactMatchWin && last?.result && last.clueId) {
        recordApplied(
          last.clueId,
          last.result,
          guess,
          last.clueId,
          null,
          0,
          null,
          0,
          undefined,
          ctxBefore,
        );
      }
      break;
    }

    // Auto mode, clue auto-resolved during SUBMIT (no chooser parked).
    if (!state.pendingGuess) {
      const last = state.guesses[state.guesses.length - 1];
      if (last?.result && last.clueId) {
        recordApplied(
          last.clueId,
          last.result,
          guess,
          last.clueId,
          null,
          0,
          null,
          0,
          undefined,
          ctxBefore,
        );
      }
      continue;
    }

    // pendingGuess is set → chooser path (manual OR auto+paramKind).
    for (const c of state.pendingGuess.options) {
      stats.offeredIds.add(c.id);
    }
    if (stats.pair1Categories === null) {
      stats.pair1Categories = [
        state.pendingGuess.options[0].category,
        state.pendingGuess.options[1].category,
      ];
    }

    let redrawsThisRound = 0;

    // Auto-mode paramKind clue. In practice only Contains Digit (slot
    // multi-pick) — Oracle has no paramKind. We drive the multi-pick
    // by greedy slot order (left-to-right) and dispatch with all
    // picks at once via the param. The state machine resolves the
    // round and (for non-final picks) parks pendingGuess again with
    // the chained picks; we simulate the player's UI-driven loop by
    // accumulating picks until the round completes against the
    // target's remaining-digit multiset.
    if (mode === "auto") {
      const clue = state.pendingGuess.options[0];
      // Drive Contains Digit's multi-pick by simulating the player
      // picking left-to-right. We pick all slots in [0..digits) at
      // once; resolveContainsDigitPicks short-circuits on red.
      if (clue.id === "containsDigit") {
        const allSlots: number[] = [];
        for (let i = 0; i < digits; i++) allSlots.push(i);
        state = reduce(state, {
          type: "CHOOSE_CLUE",
          clueId: clue.id,
          param: { picks: allSlots } as never,
        });
      } else {
        state = reduce(state, { type: "CHOOSE_CLUE", clueId: clue.id });
      }
      const last = state.guesses[state.guesses.length - 1];
      if (last?.result) {
        recordApplied(
          clue.id,
          last.result,
          guess,
          clue.id,
          null,
          0,
          null,
          0,
          undefined,
          ctxBefore,
        );
      }
      continue;
    }

    // Manual mode: redraw loop. Score, decide if both options are weak,
    // burn a lock to redraw, repeat up to MAX_REDRAWS_PER_GAME.
    while (true) {
      const options = state.pendingGuess!.options;
      const scoreP = pickClueStrategic(
        options,
        candidates,
        guess,
        ctxBefore,
        stats.cluePicks,
        stats.decisions.length + 1,
      );
      // Redraw eligibility check.
      const pickedBits = expectedToBits(scoreP.pickedExp, candidates.length);
      const canRedraw =
        lockBudget > 0 &&
        stats.redraws < MAX_REDRAWS_PER_GAME &&
        // Reserve one lock for a possible follow-up safety lock.
        lockBudget >= 2 &&
        pickedBits < REDRAW_INFO_FLOOR;
      if (canRedraw) {
        state = reduce(state, { type: "REDRAW" });
        lockBudget -= 1;
        stats.redraws += 1;
        redrawsThisRound += 1;
        for (const c of state.pendingGuess!.options) {
          stats.offeredIds.add(c.id);
        }
        continue;
      }
      // Commit the pick.
      const pickedClue = options[scoreP.pickedIdx];
      const otherClue = options[1 - scoreP.pickedIdx];
      if (stats.pair1PickedCategory === null) {
        stats.pair1PickedCategory = pickedClue.category;
      }

      // Contains Digit needs param picks; in the chooser path we drive
      // it left-to-right same as the auto path.
      let chooseParam: Record<string, unknown> | undefined;
      if (pickedClue.id === "containsDigit") {
        const allSlots: number[] = [];
        for (let i = 0; i < digits; i++) allSlots.push(i);
        chooseParam = { picks: allSlots };
      } else if (pickedClue.id === "clueReuse" && scoreP.pickedReusedId) {
        chooseParam = { reusedClueId: scoreP.pickedReusedId };
        // If the reused clue is Contains Digit, also supply picks.
        if (scoreP.pickedReusedId === "containsDigit") {
          const allSlots: number[] = [];
          for (let i = 0; i < digits; i++) allSlots.push(i);
          chooseParam = { reusedClueId: "containsDigit", picks: allSlots };
        }
      } else if (pickedClue.id === "clueReuse" && !scoreP.pickedReusedId) {
        // No prior to reuse — fall back to the other clue.
        state = reduce(state, { type: "CHOOSE_CLUE", clueId: otherClue.id });
        const last = state.guesses[state.guesses.length - 1];
        if (last?.result) {
          recordApplied(
            otherClue.id,
            last.result,
            guess,
            otherClue.id,
            pickedClue.id,
            scoreP.otherExp,
            scoreP.pickedExp,
            redrawsThisRound,
            undefined,
            ctxBefore,
          );
        }
        break;
      }

      state = reduce(state, {
        type: "CHOOSE_CLUE",
        clueId: pickedClue.id,
        ...(chooseParam ? { param: chooseParam as never } : {}),
      });

      const last = state.guesses[state.guesses.length - 1];
      if (!last?.result || !last.clueId) break;
      const appliedClueId: ClueId = last.clueId; // for Clue Reuse, this stays "clueReuse"
      // Determine the underlying clue we filter by: for Clue Reuse it's
      // the reused id (the result's kind matches the reused clue), for
      // everything else it's the chosen id.
      const filterId: ClueId =
        pickedClue.id === "clueReuse" && scoreP.pickedReusedId
          ? scoreP.pickedReusedId
          : appliedClueId;

      if (pickedClue.id === "clueReuse" && scoreP.pickedReusedId) {
        lockBudget -= 1; // Clue Reuse cost
        stats.clueReusePicks += 1;
        stats.reuseAppliedTo.push(scoreP.pickedReusedId);
      }

      recordApplied(
        filterId,
        last.result,
        guess,
        pickedClue.id,
        otherClue.id,
        scoreP.pickedExp,
        scoreP.otherExp,
        redrawsThisRound,
        scoreP.pickedReusedId,
        ctxBefore,
      );
      break;
    }
  }

  stats.won = state.status === "won";
  stats.locksRemaining = Math.max(0, lockBudget);
  return stats;
}

// Re-export for downstream consumers (the sim test).
export { allCandidates, META_CLUE_IDS };
