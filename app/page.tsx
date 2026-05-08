import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { HomeHeaderIcons } from "@/components/HomeHeaderIcons";
import { UnlimitedHomeRow } from "@/components/UnlimitedHomeRow";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
      <HomeHeaderIcons />
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3 font-mono">
          mathymath
        </h1>
        <p className="text-muted mb-8 text-sm leading-relaxed">
          A number-guessing Wordle.
          <br />
          Pick your clue each round.
        </p>

        <div className="grid gap-3 mb-8">
          <div className="flex items-stretch gap-2">
            <Link
              href="/daily"
              className="flex-1 bg-accent/80 text-background font-semibold py-4 rounded-xl active:scale-[0.99] transition text-center"
            >
              Today&apos;s Puzzle
            </Link>
            <Link
              href="/archive"
              aria-label="Archive — play past daily puzzles"
              title="Archive"
              className="bg-accent/80 text-background rounded-xl active:scale-[0.99] transition flex items-center justify-center w-14 text-xl"
            >
              📅
            </Link>
          </div>
          <UnlimitedHomeRow />
          <Link
            href="/deduction"
            className="block bg-surface-2 text-foreground font-semibold py-4 rounded-xl border border-border active:scale-[0.99] transition text-center"
          >
            Logical Deduction
          </Link>
        </div>

        <Countdown label="Next daily in" />
      </div>
    </main>
  );
}
