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
} from "@/lib/game/deduction/puzzles";

type Phase = "playing" | "correct" | "wrong";

export default function DeductionPage() {
  const [puzzle, setPuzzle] = useState<DeductionPuzzle>(() =>
    pickDeductionPuzzle(),
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
    const next = pickDeductionPuzzle(puzzle.id);
    setPuzzle(next);
    setInput("");
    setPhase("playing");
    setFinalGuess(null);
  }, [puzzle.id]);

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
              explanation={puzzle.explanation}
              onNext={handleNext}
            />
          )}
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
