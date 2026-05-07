import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateDailyTarget,
  todayUtcISO,
} from "@/lib/game/targetGenerator";
import {
  CLUE_REUSE_CLUE_ID,
  CLUE_REUSE_COST,
  INITIAL_LOCKS,
  locksAvailable as computeLocksAvailable,
} from "@/lib/game/locks";
import { validateDailyHistory } from "@/lib/api/dailyValidation";
import type { ClueId } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";
import { deriveCertainDigits, knownSlotsFromHistory } from "@/lib/game/certain";

const DIGITS = 5;
const MAX_GUESSES = DEFAULT_MAX_GUESSES;

const historyGuessSchema = z.object({
  guess: z.string(),
  clueId: z.string().optional(),
  result: z.unknown().optional(),
  locks: z
    .array(
      z.object({
        slot: z.number().int().min(0).max(DIGITS - 1),
        digit: z.string().regex(/^[0-9]$/),
        correct: z.boolean(),
      }),
    )
    .optional(),
  redraws: z.number().int().min(0).optional(),
});

const clueParamSchema = z
  .object({
    selectedSlot: z.number().int().min(0).max(DIGITS - 1).optional(),
    selectedDigit: z.number().int().min(0).max(9).optional(),
    picks: z.array(z.number().int().min(0).max(9)).max(20).optional(),
    reusedClueId: z.string().min(1).optional(),
  })
  .optional();

const pendingLockSchema = z.object({
  slot: z.number().int().min(0).max(DIGITS - 1),
  digit: z.string().regex(/^[0-9]$/),
  correct: z.boolean(),
});

const bodySchema = z.object({
  history: z.array(historyGuessSchema).max(MAX_GUESSES),
  pendingGuess: z.string().length(DIGITS).regex(/^[0-9]+$/),
  clueId: z.string().min(1),
  clueParam: clueParamSchema,
  /** Number of redraws on the current round (how many times the player
   *  burned a lock to advance the deck). The server uses this to derive
   *  which pair the clue was drawn from. */
  redraws: z.number().int().min(0).max(5).default(0),
  /** Locks resolved on the pending (not-yet-history) guess. Only used
   *  for the Oracle-win certain-digits check below — a correct lock on
   *  the pending guess can complete the target when combined with an
   *  Oracle reveal. The submit-guess endpoint already authoritatively
   *  resolved correctness, so we trust it as we did for `result`. */
  pendingLocks: z.array(pendingLockSchema).max(2).optional(),
});

/**
 * POST /api/daily/[date]/choose-clue
 *
 * Resolves a pending guess by computing its clue result server-side.
 * The state machine guarantees choose-clue is never reached on a final
 * slot (submit-guess handles that path), so the response is always
 * `{ kind: "continue", result }` unless the inputs fail validation.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  if (date > todayUtcISO()) {
    return NextResponse.json({ error: "future_date" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const target = generateDailyTarget(date, DIGITS);
  const validation = validateDailyHistory({
    target,
    digits: DIGITS,
    maxGuesses: MAX_GUESSES,
    seed: date,
    history: parsed.data.history,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 409 });
  }
  if (validation.status !== "playing") {
    return NextResponse.json({ error: "game_over" }, { status: 409 });
  }

  const { pendingGuess, clueId } = parsed.data;

  // Defensive: pendingGuess cannot be the target here. The exact-match
  // path only goes through submit-guess, which short-circuits to `won`
  // and never offers a chooser.
  if (pendingGuess === target) {
    return NextResponse.json({ error: "exact_match_in_choose" }, { status: 409 });
  }

  // Compute the cumulative deck offset from prior rounds' redraws so
  // the pair validation matches what the client drew after redraws.
  const priorRedraws = (parsed.data.history as Array<{ redraws?: number }>)
    .reduce((sum, g) => sum + (g.redraws ?? 0), 0);
  const totalOffset = priorRedraws + parsed.data.redraws;

  // Ensure the claimed clueId was actually one of the two offered at
  // this point — the same pickTwoClues invocation the client saw.
  const offered = pickTwoClues(date, validation.chosenClueIds, totalOffset);
  const offeredIds = offered.map((c) => c.id);
  if (!offeredIds.includes(clueId as (typeof offeredIds)[number])) {
    return NextResponse.json({ error: "clue_not_offered" }, { status: 409 });
  }

  // Also confirm it's not a duplicate (paranoia: pickTwoClues already
  // excludes used ids, so this should be impossible).
  if (validation.chosenClueIds.includes(clueId as (typeof offeredIds)[number])) {
    return NextResponse.json({ error: "clue_reused" }, { status: 409 });
  }

  // Clue Reuse costs locks; the player must have enough budget AFTER
  // this turn's redraws to afford it. The validator above already
  // counts wrong locks from prior history; redraws on the current turn
  // come in via parsed.data.redraws.
  if (clueId === CLUE_REUSE_CLUE_ID) {
    const budgetBeforeTurn = computeLocksAvailable(
      parsed.data.history as Parameters<typeof computeLocksAvailable>[0],
      INITIAL_LOCKS,
    );
    const budgetAtPick = budgetBeforeTurn - parsed.data.redraws;
    if (budgetAtPick < CLUE_REUSE_COST) {
      return NextResponse.json(
        { error: "clue_reuse_no_budget" },
        { status: 409 },
      );
    }
  }

  const clue = getClueById(clueId as (typeof offeredIds)[number]);
  // Oracle (and any future context-aware clue) sees the slots the
  // player already knows going into THIS guess. Must be the pre-guess
  // knowledge — the pending guess hasn't been committed to history yet.
  const knownSlots = knownSlotsFromHistory(
    parsed.data.history as Parameters<typeof knownSlotsFromHistory>[0],
    DIGITS,
  );
  const priorResults = parsed.data.history
    .map((g) => g.result as import("@/lib/game/clues/types").ClueResult | undefined)
    .filter(
      (r): r is import("@/lib/game/clues/types").ClueResult => r !== undefined,
    );
  const priorGuesses = parsed.data.history.map((g) => g.guess);
  // Player-selected params (Contains Digit → picks; Clue Reuse →
  // reusedClueId) are forwarded into the compute context alongside
  // knownSlots. Oracle auto-picks its slot, so it ignores selectedSlot.
  const { clueParam } = parsed.data;
  const result = clue.compute(pendingGuess, target, {
    knownSlots,
    priorResults,
    priorGuesses,
    ...clueParam,
  });

  // Contains Digit interactive: if the player's pick sequence isn't
  // yet complete (no wrong pick AND guess multiset not exhausted),
  // return a "needs-pick" response so the client can collect another
  // pick. The round is finalized only when the player gets one wrong
  // or runs out of guess digits.
  if (result.kind === "containsDigit") {
    const { containsDigitRoundComplete, containsDigitAvailable } = await import(
      "@/lib/game/clues/containsDigit"
    );
    const complete = containsDigitRoundComplete(pendingGuess, result.picks);
    if (!complete) {
      const available = containsDigitAvailable(
        pendingGuess,
        result.picks.map((p) => p.digit),
      );
      return NextResponse.json({
        kind: "needs-pick",
        partialPicks: result.picks,
        availableDigits: available,
      });
    }
  }

  // Oracle-induced win: if this Oracle reveal (possibly via Clue Reuse)
  // completes the certain set, the player wins immediately. Pending
  // locks count toward certainty here — a correct lock placed on this
  // turn pins target[slot] just like a prior-history correct lock.
  // Re-resolve their `correct` flag against the real target so a
  // tampered client can't fake certainty. Reveal the target on win so
  // the client can render the final state.
  if (result.kind === "oracle") {
    const verifiedPendingLocks = (parsed.data.pendingLocks ?? []).map((l) => ({
      slot: l.slot,
      digit: l.digit,
      correct: target[l.slot] === l.digit,
    }));
    const historyAfter = [
      ...parsed.data.history,
      {
        guess: pendingGuess,
        clueId: clueId as ClueId,
        result,
        ...(verifiedPendingLocks.length > 0
          ? { locks: verifiedPendingLocks }
          : {}),
      },
    ];
    const certain = deriveCertainDigits(
      historyAfter as Parameters<typeof deriveCertainDigits>[0],
      DIGITS,
    );
    if (certain.every((d) => d !== null)) {
      return NextResponse.json({ kind: "won", result, target });
    }
    // Fallback win: if the player's pending guess matches the target
    // at every slot except the Oracle-revealed slot, Oracle just
    // filled the only mistake and the player has effectively solved
    // the puzzle. Skip the redundant resubmit step.
    const oracleSlot = result.slot;
    const matchesElsewhere = [...pendingGuess].every(
      (ch, i) => i === oracleSlot || ch === target[i],
    );
    if (matchesElsewhere) {
      return NextResponse.json({ kind: "won", result, target });
    }
  }

  return NextResponse.json({ kind: "continue", result });
}
