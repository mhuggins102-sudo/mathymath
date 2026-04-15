import { notFound } from "next/navigation";
import { todayUtcISO } from "@/lib/game/targetGenerator";
import { DailyGame } from "./DailyGame";

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export default async function DailyPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();
  const today = todayUtcISO();
  if (date > today) notFound();

  // NOTE: the target is NOT generated here and NOT passed to the client.
  // The daily flow is server-mediated — each guess hits the
  // /api/daily/[date]/(submit-guess|choose-clue) endpoints which derive
  // the target server-side, replay the client's history to catch
  // tampering, and return just the next piece of state. The target is
  // only revealed in responses on terminal game states.
  return (
    <DailyGame
      date={date}
      isToday={date === today}
      digits={5}
      maxGuesses={8}
    />
  );
}
