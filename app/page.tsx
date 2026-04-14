import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
      <div className="max-w-md w-full">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          <span className="digit-2">m</span>
          <span className="digit-5">a</span>
          <span className="digit-7">t</span>
          <span className="digit-1">h</span>
          <span className="digit-9">y</span>
          <span className="digit-4">m</span>
          <span className="digit-6">a</span>
          <span className="digit-8">t</span>
          <span className="digit-3">h</span>
        </h1>
        <p className="text-muted mb-10 text-sm">
          A number-guessing Wordle. Pick your clue each round.
        </p>

        <div className="grid gap-3">
          <Link
            href="/unlimited"
            className="block bg-accent/80 text-background font-semibold py-4 rounded-xl active:scale-[0.99] transition"
          >
            Play Unlimited
          </Link>
          <button
            type="button"
            disabled
            className="block bg-surface text-muted font-semibold py-4 rounded-xl border border-border cursor-not-allowed"
            title="Coming soon"
          >
            Daily Puzzle — coming soon
          </button>
        </div>

        <p className="text-xs text-muted mt-10">
          5 digits. 8 guesses. Repeats allowed.
        </p>
      </div>
    </main>
  );
}
