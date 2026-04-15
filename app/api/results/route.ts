import { NextResponse } from "next/server";
import { z } from "zod";
import { getDailyStore } from "@/lib/api/dailyStore";
import {
  generateDailyTarget,
  todayUtcISO,
} from "@/lib/game/targetGenerator";
import { validateDailyHistory } from "@/lib/api/dailyValidation";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";

const DIGITS = 5;
const MAX_GUESSES = DEFAULT_MAX_GUESSES;

const historyGuessSchema = z.object({
  guess: z.string(),
  clueId: z.string().optional(),
  result: z.unknown().optional(),
});

// The client now sends its full history so the server can verify that
// the claimed {won, guessCount} actually matches a real valid play.
// Without `history` the results endpoint is trust-the-client and a
// forger can POST { won:true, guessCount:1 } with no way for us to
// reject it; with the history, verification requires knowing the real
// target — which only the server has.
const submitSchema = z.object({
  clientId: z.string().uuid(),
  puzzleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  history: z.array(historyGuessSchema).max(MAX_GUESSES),
  durationMs: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (data.puzzleDate > todayUtcISO()) {
    return NextResponse.json({ error: "future_date" }, { status: 400 });
  }

  // Re-derive target and replay the history. This is the integrity gate
  // — a forged submission must reproduce every clue result exactly
  // against a target the client never saw.
  const target = generateDailyTarget(data.puzzleDate, DIGITS);
  const validation = validateDailyHistory({
    target,
    digits: DIGITS,
    maxGuesses: MAX_GUESSES,
    seed: data.puzzleDate,
    history: data.history,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: "history_invalid", detail: validation.error },
      { status: 409 },
    );
  }
  if (validation.status === "playing") {
    return NextResponse.json(
      { error: "game_not_over" },
      { status: 409 },
    );
  }

  const won = validation.status === "won";
  const guessCount = data.history.length;
  const chosenClues = data.history
    .map((g, i) => ({ guessIdx: i, clueId: g.clueId }))
    .filter((c): c is { guessIdx: number; clueId: string } => !!c.clueId);

  const res = await getDailyStore().submit({
    clientId: data.clientId,
    puzzleDate: data.puzzleDate,
    guessCount,
    won,
    chosenClues,
    durationMs: data.durationMs,
    createdAt: Date.now(),
  });
  return NextResponse.json(res);
}
