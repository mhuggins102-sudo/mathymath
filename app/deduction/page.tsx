"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  GuessGrid,
  type GuessGridState,
} from "@/components/GuessGrid";
import { Keypad } from "@/components/Keypad";
import { DeductionResultCard } from "@/components/DeductionResultCard";
import { HelpModal } from "@/components/HelpModal";
import { useKeyboardInput } from "@/lib/hooks/useKeyboardInput";
import {
  deriveCertainDigits,
  buildGuessFromInput,
  inputCapacity,
} from "@/lib/game/certain";
import {
  pickDeductionPuzzle,
  type DeductionPuzzle,
  type Difficulty,
} from "@/lib/game/deduction/puzzles";
import { explainWrongGuess } from "@/lib/game/deduction/explain";

type Phase = "playing" | "correct" | "wrong";

export default function DeductionPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [puzzle, setPuzzle] = useState<DeductionPuzzle>(() =>
    pickDeductionPuzzle("all"),
  );
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("playing");
  const [finalGuess, setFinalGuess] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const certainDigits = useMemo(
    () => deriveCertainDigits(puzzle.guesses, puzzle.digits),
    [puzzle],
  );
  const capacity = useMemo(() => inputCapacity(certainDigits), [certainDigits]);

  const gridState = useMemo((): GuessGridState => {
    const resolvedGuesses = [
      ...puzzle.guesses,
      ...(finalGuess !== null
        ? [
            {
              guess: finalGuess,
              result: {
                kind: "bullseyes" as const,
                hits: Array.from(
                  { length: puzzle.digits },
                  (_, i) => finalGuess[i] === puzzle.target[i],
                ),
              },
            },
          ]
        : []),
    ];
    return {
      digits: puzzle.digits,
      status:
        phase === "playing" ? "playing" : phase === "correct" ? "won" : "lost",
      guesses: resolvedGuesses,
      pendingGuess: null,
    };
  }, [puzzle, finalGuess, phase]);

  const appendDigit = useCallback(
    (d: string) => {
      if (phase !== "playing") return;
      setInput((prev) => (prev.length < capacity ? prev + d : prev));
    },
    [phase, capacity],
  );

  const backspace = useCallback(() => {
    if (phase !== "playing") return;
    setInput((prev) => prev.slice(0, -1));
  }, [phase]);

  const submit = useCallback(() => {
    if (phase !== "playing") return;
    const full = buildGuessFromInput(certainDigits, input);
    if (full.length !== puzzle.digits) return;
    setFinalGuess(full);
    setPhase(full === puzzle.target ? "correct" : "wrong");
  }, [phase, certainDigits, input, puzzle]);

  useKeyboardInput({
    appendDigit,
    backspace,
    submit,
    disabled: phase !== "playing",
  });

  const submitDisabled = input.length !== capacity || phase !== "playing";

  const handleNext = useCallback(() => {
    const next = pickDeductionPuzzle(difficulty, puzzle.id);
    setPuzzle(next);
    setInput("");
    setPhase("playing");
    setFinalGuess(null);
  }, [difficulty, puzzle.id]);

  const handleDifficultyChange = useCallback(
    (next: Difficulty) => {
      if (next === difficulty) return;
      setDifficulty(next);
      // Switching difficulty starts a fresh puzzle from the new bucket.
      const fresh = pickDeductionPuzzle(next);
      setPuzzle(fresh);
      setInput("");
      setPhase("playing");
      setFinalGuess(null);
    },
    [difficulty],
  );

  const failures = useMemo(() => {
    if (phase !== "wrong" || finalGuess === null) return undefined;
    return explainWrongGuess(puzzle, finalGuess);
  }, [phase, finalGuess, puzzle]);

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-3 pt-3 pb-6">
      <header className="flex items-center justify-between mb-3 h-11">
        <Link href="/" className="text-muted text-sm hover:text-foreground">
          ← home
        </Link>
        <h1 className="text-sm uppercase tracking-wider text-muted">
          Logical Deduction
        </h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted text-lg font-semibold hover:text-foreground active:bg-surface-2 transition"
            onClick={() => setHelpOpen(true)}
            aria-label="Help"
          >
            ?
          </button>
        </div>
      </header>

      <DifficultySelector
        difficulty={difficulty}
        onChange={handleDifficultyChange}
      />

      <p className="text-xs text-muted text-center mb-3">
        Study the clue history — you get one guess.
      </p>

      <div className="flex-1 flex flex-col">
        <GuessGrid
          state={gridState}
          currentInput={input}
          certainDigits={certainDigits}
        />

        <div className="mt-4">
          {phase === "playing" ? (
            <Keypad
              onDigit={appendDigit}
              onBackspace={backspace}
              onSubmit={submit}
              submitDisabled={submitDisabled}
            />
          ) : (
            <DeductionResultCard
              phase={phase}
              target={puzzle.target}
              failures={failures}
              onNext={handleNext}
            />
          )}
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}

/** Four-way segmented control for picking the puzzle pool's difficulty.
 *  Same visual idiom as Unlimited's 5/6/Mix selector. */
function DifficultySelector({
  difficulty,
  onChange,
}: {
  difficulty: Difficulty;
  onChange: (next: Difficulty) => void;
}) {
  const options: { value: Difficulty; label: string }[] = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
    { value: "all", label: "All" },
  ];
  return (
    <div className="mb-3">
      <div
        role="radiogroup"
        aria-label="Puzzle difficulty"
        className="grid grid-cols-4 gap-1 bg-surface-2 rounded-md p-1"
      >
        {options.map((opt) => {
          const selected = difficulty === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={`text-xs font-semibold py-1.5 rounded transition ${
                selected
                  ? "bg-accent/80 text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
