import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateDailyTarget,
  todayUtcISO,
} from "@/lib/game/targetGenerator";
import { validateDailyHistory } from "@/lib/api/dailyValidation";
import { getClueById } from "@/lib/game/clues/registry";
import { pickTwoClues } from "@/lib/game/clueSelector";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";

const DIGITS = 5;
const MAX_GUESSES = DEFAULT_MAX_GUESSES;

const historyGuessSchema = z.object({
  guess: z.string(),
  clueId: z.string().optional(),
  result: z.unknown().optional(),
});

const bodySchema = z.object({
  history: z.array(historyGuessSchema).max(MAX_GUESSES),
  pendingGuess: z.string().length(DIGITS).regex(/^[0-9]+$/),
  clueId: z.string().min(1),
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

  // Ensure the claimed clueId was actually one of the two offered at
  // this point — the same pickTwoClues invocation the client saw.
  const offered = pickTwoClues(date, validation.chosenClueIds);
  const offeredIds = offered.map((c) => c.id);
  if (!offeredIds.includes(clueId as (typeof offeredIds)[number])) {
    return NextResponse.json({ error: "clue_not_offered" }, { status: 409 });
  }

  // Also confirm it's not a duplicate (paranoia: pickTwoClues already
  // excludes used ids, so this should be impossible).
  if (validation.chosenClueIds.includes(clueId as (typeof offeredIds)[number])) {
    return NextResponse.json({ error: "clue_reused" }, { status: 409 });
  }

  const clue = getClueById(clueId as (typeof offeredIds)[number]);
  const result = clue.compute(pendingGuess, target);

  return NextResponse.json({ kind: "continue", result });
}
