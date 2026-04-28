import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateDailyTarget,
  todayUtcISO,
} from "@/lib/game/targetGenerator";
import {
  resolveLockAttempts,
  validateDailyHistory,
} from "@/lib/api/dailyValidation";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";
import {
  INITIAL_LOCKS,
  locksAvailable as computeLocksAvailable,
} from "@/lib/game/locks";

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

const lockAttemptSchema = z.object({
  slot: z.number().int().min(0).max(DIGITS - 1),
  digit: z.string().regex(/^[0-9]$/),
});

const bodySchema = z.object({
  history: z.array(historyGuessSchema).max(MAX_GUESSES),
  guess: z.string().length(DIGITS).regex(/^[0-9]+$/),
  lockAttempts: z.array(lockAttemptSchema).max(2).optional(),
});

/**
 * POST /api/daily/[date]/submit-guess
 *
 * Client sends its full resolved history plus a new guess. Server
 * re-derives the target from `date`, replays the history to catch
 * tampering, and returns the next state:
 *   - { kind: "won", result, target }      exact match
 *   - { kind: "lost", target }              final slot used + wrong
 *   - { kind: "pending", options }          non-final wrong, offer a pair
 *
 * Target is ONLY included in the response on terminal states. During
 * ongoing play the client never receives it.
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
    // 409: client history is internally inconsistent (likely tampering,
    // otherwise a very stale cached state).
    return NextResponse.json({ error: validation.error }, { status: 409 });
  }
  if (validation.status !== "playing") {
    return NextResponse.json({ error: "game_over" }, { status: 409 });
  }

  const { guess, lockAttempts } = parsed.data;

  // Lock guard: no duplicate slots, within budget.
  if (lockAttempts && lockAttempts.length > 0) {
    const slots = new Set<number>();
    for (const a of lockAttempts) {
      if (slots.has(a.slot)) {
        return NextResponse.json(
          { error: "lock_duplicate_slot" },
          { status: 409 },
        );
      }
      slots.add(a.slot);
    }
    const budget = computeLocksAvailable(
      parsed.data.history as Parameters<typeof computeLocksAvailable>[0],
      INITIAL_LOCKS,
    );
    if (lockAttempts.length > budget) {
      return NextResponse.json(
        { error: "locks_budget_exceeded" },
        { status: 409 },
      );
    }
  }

  // Resolve correctness now so the response can echo {slot, digit, correct}
  // back to the client. The client stores these on the guess so the
  // validator catches tampering on subsequent calls.
  const resolvedLocks = resolveLockAttempts(lockAttempts ?? [], target);
  const locksField =
    resolvedLocks.length > 0 ? { locks: resolvedLocks } : {};

  // Exact match → auto-win with bullseyes. Game is over, so reveal the
  // target (it's the guess anyway, but we echo it for consistency).
  if (guess === target) {
    const result = getClueById("bullseyes").compute(guess, target);
    return NextResponse.json({ kind: "won", result, target, ...locksField });
  }

  // Final wrong guess → no clue, game ends.
  const isFinalSlot = parsed.data.history.length + 1 >= MAX_GUESSES;
  if (isFinalSlot) {
    return NextResponse.json({ kind: "lost", target, ...locksField });
  }

  // Non-final wrong guess → offer a pair. Only the ids travel over the
  // wire; the client reconstructs the Clue objects via getClueById.
  // Sum prior rounds' redraws so the deck pointer advances past
  // already-offered (and discarded) pairs from earlier redraws — without
  // this, the next round re-offered the same pair the player redrew
  // into, and the subsequent choose-clue rejected the pick because its
  // own pickTwoClues call DID account for redraws.
  const priorRedraws = parsed.data.history.reduce(
    (sum, g) => sum + (g.redraws ?? 0),
    0,
  );
  const options = pickTwoClues(
    date,
    validation.chosenClueIds,
    priorRedraws,
  );
  return NextResponse.json({
    kind: "pending",
    options: [options[0].id, options[1].id],
    ...locksField,
  });
}
