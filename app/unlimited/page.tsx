"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { useGame } from "@/lib/hooks/useGame";
import { DEFAULT_MAX_GUESSES } from "@/lib/game/stateMachine";
import type { ClueId } from "@/lib/game/clues/types";
import { generateRandomTarget } from "@/lib/game/targetGenerator";
import { GuessGrid } from "@/components/GuessGrid";
import { Keypad } from "@/components/Keypad";
import { ClueChooser } from "@/components/ClueChooser";
import { SlotPicker, DigitPicker, ReusePicker } from "@/components/CluePickers";
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
    certainDigits,
    inputCapacity,
    lockedSlots,
    pendingLockSlot,
    locksAvailable,
    canCommitPendingLock,
    unlockMode,
    pendingClueParam,
    confirmClueParam,
    cancelClueParam,
    redraw,
    canRedraw,
    tapCell,
    commitLock,
  } = useGame({
    target: session.target,
    seed: session.seed,
    digits: 5,
    maxGuesses: DEFAULT_MAX_GUESSES,
    trackStats: true,
  });

  const keypadDisabled = state.status !== "playing" || !!state.pendingGuess;
  // Submit enabled once typed input fills every non-certain slot AND
  // no lock is still pending (must be committed or cancelled first).
  const submitDisabled =
    input.length !== inputCapacity ||
    pendingLockSlot !== null ||
    keypadDisabled;
  const lockMode = pendingLockSlot !== null;
  // Lock hint shows how many are LEFT after accounting for locks the
  // player has committed this turn (but not yet submitted). Updates
  // immediately on commit and on cancel/undo.
  const hintLocks = locksAvailable - lockedSlots.length;

  const statusMessage = useMemo(() => {
    if (state.status === "won")
      return `Solved in ${state.guesses.length} guess${state.guesses.length === 1 ? "" : "es"}!`;
    if (state.status === "lost")
      return `Out of guesses. Target was ${state.target}.`;
    return null;
  }, [state.status, state.guesses.length, state.target]);

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-3 pt-3 pb-6">
      <header className="flex items-center justify-between mb-3 h-11">
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
        <GuessGrid
          state={state}
          currentInput={input}
          certainDigits={certainDigits}
          lockedSlots={lockedSlots}
          pendingLockSlot={pendingLockSlot}
          onTapCell={tapCell}
        />

        {error && <p className="text-bad text-xs text-center mt-2 shake">{error}</p>}

        <div className="mt-4">
          {/* Clue-param pickers: shown after the player picks a clue
              that requires a slot (Oracle) or digit (Contains Digit)
              selection before it resolves. */}
          {pendingClueParam?.paramKind === "slot" ? (
            <SlotPicker
              digits={5}
              certainDigits={certainDigits}
              onSelect={(slot) =>
                confirmClueParam({ selectedSlot: slot })
              }
              onCancel={cancelClueParam}
            />
          ) : pendingClueParam?.paramKind === "reuse" ? (
            <ReusePicker
              usedClueIds={state.guesses
                .map((g) => g.clueId)
                .filter(Boolean) as ClueId[]}
              onSelect={(clueId) =>
                confirmClueParam({ reusedClueId: clueId })
              }
              onCancel={cancelClueParam}
            />
          ) : pendingClueParam?.paramKind === "digit" ? (
            <DigitPicker
              onSelect={(digit) =>
                confirmClueParam({ selectedDigit: digit })
              }
              onCancel={cancelClueParam}
            />
          ) : state.pendingGuess ? (
            <ClueChooser
              options={state.pendingGuess.options}
              onChoose={chooseClue}
              onRedraw={redraw}
              canRedraw={canRedraw}
            />
          ) : state.status === "playing" ? (
            <>
              <Keypad
                onDigit={appendDigit}
                onBackspace={backspace}
                onSubmit={submit}
                disabled={keypadDisabled}
                submitDisabled={submitDisabled}
                lockMode={lockMode}
                onLockCommit={commitLock}
                lockCommitDisabled={!canCommitPendingLock && !unlockMode}
                unlockMode={unlockMode}
              />
              {/* Lock hint sits below the keypad so it doesn't shift
                  the keypad around as it appears/disappears. */}
              <p className="text-[10px] text-muted text-center mt-2 min-h-4">
                {lockMode
                  ? unlockMode
                    ? "Press Unlock to remove the lock — or tap a different slot."
                    : canCommitPendingLock
                    ? "Press Lock to confirm — or pick a different digit, or tap the slot again to cancel."
                    : "Pick a digit for the highlighted slot, then press Lock — or tap the slot again to cancel."
                  : hintLocks > 0
                  ? `🔒 ${hintLocks} lock${hintLocks === 1 ? "" : "s"} available${state.guesses.length === 0 ? " (usable from guess 2)" : " — tap a cell to use"}`
                  : ""}
              </p>
            </>
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
