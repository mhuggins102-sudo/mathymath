"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { useGame } from "@/lib/hooks/useGame";
import { generateRandomTarget } from "@/lib/game/targetGenerator";
import { GuessGrid } from "@/components/GuessGrid";
import { Keypad } from "@/components/Keypad";
import { ClueChooser } from "@/components/ClueChooser";
import { HelpModal } from "@/components/HelpModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { LifetimeStatsModal } from "@/components/LifetimeStatsModal";

function newSession() {
  return { target: generateRandomTarget(5), seed: uuidv4() };
}

export default function UnlimitedPage() {
  const [session, setSession] = useState<{ target: string; seed: string } | null>(
    null,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

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

  return (
    <UnlimitedGame
      // key forces a full remount (fresh reducer state, fresh effects) on "New puzzle"
      key={session.seed}
      session={session}
      onNew={() => setSession(newSession())}
      helpOpen={helpOpen}
      setHelpOpen={setHelpOpen}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      statsOpen={statsOpen}
      setStatsOpen={setStatsOpen}
    />
  );
}

function UnlimitedGame({
  session,
  onNew,
  helpOpen,
  setHelpOpen,
  settingsOpen,
  setSettingsOpen,
  statsOpen,
  setStatsOpen,
}: {
  session: { target: string; seed: string };
  onNew: () => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  statsOpen: boolean;
  setStatsOpen: (v: boolean) => void;
}) {
  const {
    state,
    input,
    error,
    appendDigit,
    backspace,
    submit,
    chooseClue,
  } = useGame({
    target: session.target,
    seed: session.seed,
    digits: 5,
    maxGuesses: 8,
    trackStats: true,
  });

  const keypadDisabled = state.status !== "playing" || !!state.pendingGuess;
  const submitDisabled = input.length !== state.digits || keypadDisabled;

  const statusMessage = useMemo(() => {
    if (state.status === "won")
      return `Solved in ${state.guesses.length} guess${state.guesses.length === 1 ? "" : "es"}!`;
    if (state.status === "lost")
      return `Out of guesses. Target was ${state.target}.`;
    return null;
  }, [state.status, state.guesses.length, state.target]);

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-3 pt-3 pb-6">
      <header className="flex items-center justify-between mb-3">
        <Link href="/" className="text-muted text-sm hover:text-foreground">
          ← home
        </Link>
        <h1 className="text-sm uppercase tracking-wider text-muted">Unlimited</h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted text-base hover:text-foreground active:bg-surface-2 transition"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            ⚙
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted text-base hover:text-foreground active:bg-surface-2 transition"
            onClick={() => setStatsOpen(true)}
            aria-label="Unlimited stats"
          >
            📊
          </button>
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

      <div className="flex-1 flex flex-col">
        <GuessGrid state={state} currentInput={input} />

        {error && <p className="text-bad text-xs text-center mt-2 shake">{error}</p>}

        <div className="mt-4">
          {state.pendingGuess ? (
            <ClueChooser
              options={state.pendingGuess.options}
              onChoose={chooseClue}
            />
          ) : state.status === "playing" ? (
            <Keypad
              onDigit={appendDigit}
              onBackspace={backspace}
              onSubmit={submit}
              disabled={keypadDisabled}
              submitDisabled={submitDisabled}
            />
          ) : (
            <div className="text-center space-y-4">
              <p
                className={`font-semibold ${
                  state.status === "won" ? "text-good" : "text-bad"
                }`}
              >
                {statusMessage}
              </p>
              <button
                type="button"
                onClick={onNew}
                className="bg-accent/80 text-background font-semibold px-6 py-2 rounded-lg active:scale-95"
              >
                New puzzle
              </button>
              <p className="text-xs text-muted">
                Tap 📊 above to see your unlimited stats.
              </p>
            </div>
          )}
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LifetimeStatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        mode="unlimited"
      />
    </main>
  );
}
