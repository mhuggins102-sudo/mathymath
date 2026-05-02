"use client";

interface DeductionResultCardProps {
  phase: "correct" | "wrong";
  target: string;
  /** One sentence per clue the player's guess violates. Empty means
   *  no clues were broken (only possible on a correct guess). */
  failures?: string[];
  onNext: () => void;
}

export function DeductionResultCard({
  phase,
  target,
  failures,
  onNext,
}: DeductionResultCardProps) {
  return (
    <div className="space-y-4 text-center">
      {phase === "correct" ? (
        <p className="font-semibold text-good text-lg">Correct!</p>
      ) : (
        <div className="space-y-2">
          <p className="font-semibold text-bad">Not quite.</p>
          <p className="text-sm text-muted">
            The answer was{" "}
            <span className="font-mono font-bold text-foreground">{target}</span>
          </p>
          {failures && failures.length > 0 && (
            <ul className="text-xs text-muted leading-relaxed text-left list-disc pl-5 space-y-1">
              {failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onNext}
        className="bg-accent/80 text-background font-semibold px-6 py-2 rounded-lg active:scale-95 transition"
      >
        Try another
      </button>
    </div>
  );
}
