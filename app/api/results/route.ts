import { NextResponse } from "next/server";
import { z } from "zod";
import { getDailyStore } from "@/lib/api/dailyStore";
import { todayUtcISO } from "@/lib/game/targetGenerator";

const submitSchema = z.object({
  clientId: z.string().uuid(),
  puzzleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guessCount: z.number().int().min(1).max(20),
  won: z.boolean(),
  chosenClues: z.array(
    z.object({
      guessIdx: z.number().int().min(0),
      clueId: z.string(),
    }),
  ),
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
  const res = await getDailyStore().submit({
    clientId: data.clientId,
    puzzleDate: data.puzzleDate,
    guessCount: data.guessCount,
    won: data.won,
    chosenClues: data.chosenClues,
    durationMs: data.durationMs,
    createdAt: Date.now(),
  });
  return NextResponse.json(res);
}
