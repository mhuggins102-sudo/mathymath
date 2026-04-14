import { notFound } from "next/navigation";
import { generateDailyTarget, todayUtcISO } from "@/lib/game/targetGenerator";
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

  const target = generateDailyTarget(date, 5);

  return (
    <DailyGame
      date={date}
      target={target}
      isToday={date === today}
      digits={5}
      maxGuesses={8}
    />
  );
}
