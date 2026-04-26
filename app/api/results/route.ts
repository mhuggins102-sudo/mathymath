import { NextResponse } from "next/server";
import { z } from "zod";
import { getDailyStore } from "@/lib/api/dailyStore";
import {
  generateDailyTarget,
  todayUtcISO,
} from "@/lib/game/targetGenerator";
import { validateDailyHistory } from "@/lib/api/dailyValidation";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";

// The leaderboard view depends on every other player's submissions, so
// this endpoint MUST recompute on every request — no caching at the
// Next.js layer or the CDN edge. Without these the Cloudflare runtime
// has been observed to serve a player their own first-write aggregate
// on reload, even though new entries are already in D1.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIGITS = 5;
const MAX_GUESSES = DEFAULT_MAX_GUESSES;

/** Cache-busting headers for the response: tell every layer that this
 *  body must NOT be reused for any subsequent request. */
const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate",
  "cdn-cache-control": "no-store",
};

const historyGuessSchema = z.object({
  guess: z.string(),
  clueId: z.string().optional(),
  result: z.unknown().optional(),
  locks: z
    .array(
      z.object({
        slot: z.number().int().min(0).max(4),
        digit: z.string().regex(/^[0-9]$/),
        correct: z.boolean(),
      }),
    )
    .optional(),
  redraws: z.number().int().min(0).optional(),
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
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const data = parsed.data;
  if (data.puzzleDate > todayUtcISO()) {
    return NextResponse.json(
      { error: "future_date" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
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
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }
  if (validation.status === "playing") {
    return NextResponse.json(
      { error: "game_not_over" },
      { status: 409, headers: NO_STORE_HEADERS },
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
  return NextResponse.json(res, { headers: NO_STORE_HEADERS });
}
