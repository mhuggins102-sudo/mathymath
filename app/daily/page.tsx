import { redirect } from "next/navigation";
import { todayUtcISO } from "@/lib/game/targetGenerator";

export default function DailyRedirect() {
  redirect(`/daily/${todayUtcISO()}`);
}
