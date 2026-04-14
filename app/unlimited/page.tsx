"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { useGame } from "@/lib/hooks/useGame";
import { generateRandomTarget } from "@/lib/game/targetGenerator";
import { GuessGrid } from "@/components/GuessGrid";
import { Keypad } from "@/components/Keypad";
import { ClueChoiceModal } from "@/components/ClueChoiceModal";
import { HelpModal } from "@/components/HelpModal";
import { StatsPanel } from "@/components/StatsPanel";

function newSession() {
  return { target: generateRandomTarget(5), seed: uuidv4() };
}

export default function UnlimitedPage() {
  const [session, setSession] = useState<{ target: string; seed: string } | null>(
    null,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsKey, setStatsKey] = useState(0);

  // Generate client-side only so SSR and hydration don't clash.
  useEffect(() => {
    setSession(newSession());
  }, []);

  if (!session) {
    return (
      <main className="flex-1 flex items-center justify-center text-muted">
        Loading…
      </main>
    );
  }

  return <UnlimitedGame session={session} onNew={() => {
    setSession(newSession());
    setStatsKey((k) => k + 1);
  }} helpOpen={helpOpen} setHelpOpen={setHelpOpen} statsKey={statsKey} />;
}

function UnlimitedGame({
  session,
  onNew,
  helpOpen,
  setHelpOpen,
  statsKey,
}: {
  session: { target: string; seed: string };
  onNew: () => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  statsKey: number;
}) {
  const game = useGame({
    target: session.target,
    seed: session.seed,
    digits: 5,
    maxGuesses: 8,
    trackStats: true,
  });

  const { state, input, error, appendDigit, backspace, submit, chooseClue } = game;

  const keypadDisabled =
    state.status !== "playing" || !!state.pendingGuess;

  const submitDisabled = input.length !== state.digits || keypadDisabled;

  const statusMessage = useMemo(() => {
    if (state.status === "won")
      return `Solved in ${state.guesses.length} guess${
        state.guesses.length === 1 ? "" : "es"
      }!`;
    if (state.status === "lost")
      return `Out of guesses. Target was ${state.target}.`;
    return null;
  }, [state.status, state.guesses.length, state.target]);

  const handleNew = useCallback(() => {
    onNew();
  }, [onNew]);

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-3 pt-3 pb-6">
      <header className="flex items-center justify-between mb-2">
        <Link href="/" className="text-muted text-sm hover:text-foreground">
          ← home
        </Link>
        <h1 className="text-sm uppercase tracking-wider text-muted">Unlimited</h1>
        <button
          type="button"
          className="text-muted text-sm hover:text-foreground px-2"
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
        >
          ?
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto pb-4">
        <GuessGrid state={state} currentInput={input} />

        {error && (
          <p className="text-bad text-xs mt-2 shake">{error}</p>
        )}

        {statusMessage && (
          <div className="mt-4 text-center">
            <p
              className={`font-semibold mb-3 ${
                state.status === "won" ? "text-good" : "text-bad"
              }`}
            >
              {statusMessage}
            </p>
            <button
              type="button"
              onClick={handleNew}
              className="bg-accent/80 text-background font-semibold px-6 py-2 rounded-lg active:scale-95"
            >
              New puzzle
            </button>
          </div>
        )}

        {state.status !== "playing" && (
          <div className="w-full mt-6">
            <StatsPanel refreshKey={statsKey} maxGuesses={state.maxGuesses} />
          </div>
        )}
      </div>

      <div className="pt-2">
        <Keypad
          onDigit={appendDigit}
          onBackspace={backspace}
          onSubmit={submit}
          disabled={keypadDisabled}
          submitDisabled={submitDisabled}
        />
      </div>

      <ClueChoiceModal
        open={!!state.pendingGuess}
        options={state.pendingGuess?.options ?? null}
        onChoose={chooseClue}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
