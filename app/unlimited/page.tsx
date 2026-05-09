"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { useGame } from "@/lib/hooks/useGame";
import { useKeyboardInput } from "@/lib/hooks/useKeyboardInput";
import { maxGuessesForDigits } from "@/lib/game/stateMachine";
import type { ClueId } from "@/lib/game/clues/types";
import { generateRandomTarget } from "@/lib/game/targetGenerator";
import { GuessGrid } from "@/components/GuessGrid";
import { GearIcon } from "@/components/GearIcon";
import { Keypad } from "@/components/Keypad";
import { ClueChooser } from "@/components/ClueChooser";
import { DigitPicker, ReusePicker } from "@/components/CluePickers";
import { containsDigitAvailable } from "@/lib/game/clues/containsDigit";
import { HelpModal } from "@/components/HelpModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { LifetimeStatsModal } from "@/components/LifetimeStatsModal";
import { ResourceBalance } from "@/components/ResourceBalance";
import { loadSettings } from "@/lib/settings";
import {
  loadUnlimitedMode,
  type UnlimitedMode,
} from "@/lib/persistence/localStore";

interface Session {
  target: string;
  seed: string;
  digits: number;
  /** Captured at session creation so toggling Advanced mid-game has no
   *  effect on the in-progress game — only the next "New puzzle" picks
   *  up the new flag. */
  advancedMode: boolean;
  /** Same capture-at-start treatment for the Preselected Clues toggle. */
  preselectedClues: boolean;
}

/** Resolves the chosen mode to a concrete digit count for the next
 *  game. The mode union is binary now ("5" | "6") since the legacy
 *  "mix" option was retired in favor of an explicit toggle in the
 *  Unlimited settings menu. */
function resolveDigits(mode: UnlimitedMode): number {
  return mode === "6" ? 6 : 5;
}

function newSession(): Session {
  const mode = loadUnlimitedMode();
  const digits = resolveDigits(mode);
  // Read the advanced flag at session creation. SSR-safe: loadSettings
  // returns the default (false) when window is undefined, and the
  // useEffect that creates the first session runs client-side anyway.
  const settings = loadSettings();
  return {
    target: generateRandomTarget(digits),
    seed: uuidv4(),
    digits,
    advancedMode: settings.advancedMode,
    preselectedClues: settings.preselectedClues,
  };
}

export default function UnlimitedPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // Hydrate the saved mode preference on first paint and start the
  // first session against it.
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

  const onNew = () => setSession(newSession());

  return (
    <>
      <UnlimitedGame
        // key forces a full remount (fresh reducer state, fresh effects) on "New puzzle"
        key={session.seed}
        session={session}
        onNew={onNew}
        setHelpOpen={setHelpOpen}
        setSettingsOpen={setSettingsOpen}
        setStatsOpen={setStatsOpen}
      />
      {/* Modals live ABOVE the keyed game so a session-restart triggered
          from the drawer (digit mode change, advanced toggle, etc.) does
          NOT remount the drawer mid-interaction. Keeping the drawer's
          state stable across session swaps avoids the visual jitter that
          comes from useSettings re-hydrating from defaults on each
          remount. */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        context="unlimited"
        onSettingsCommit={onNew}
      />
      <LifetimeStatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
    </>
  );
}

function UnlimitedGame({
  session,
  onNew,
  setHelpOpen,
  setSettingsOpen,
  setStatsOpen,
}: {
  session: Session;
  onNew: () => void;
  setHelpOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setStatsOpen: (v: boolean) => void;
}) {
  const maxGuesses = maxGuessesForDigits(session.digits);
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
    pickContainsDigit,
    redraw,
    canRedraw,
    tapCell,
    commitLock,
    advancedMode,
    preselectedMode,
    preselectedDeck,
  } = useGame({
    target: session.target,
    seed: session.seed,
    digits: session.digits,
    maxGuesses,
    trackStats: true,
    advancedMode: session.advancedMode,
    preselectedClues: session.preselectedClues,
  });

  const keypadDisabled = state.status !== "playing" || !!state.pendingGuess;
  // Submit enabled once typed input fills every non-certain slot AND
  // no lock is still pending (must be committed or cancelled first).
  const submitDisabled =
    input.length !== inputCapacity ||
    pendingLockSlot !== null ||
    keypadDisabled;

  // Desktop keyboard parity: 0-9 type into the active row, Backspace /
  // Delete clear the last typed digit, Enter submits. No-op on mobile
  // (no physical keyboard); disabled while a clue chooser / picker is
  // up since the keypad is hidden in those states too.
  useKeyboardInput({
    appendDigit,
    backspace,
    submit,
    disabled: keypadDisabled || !!pendingClueParam,
  });
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
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-foreground active:bg-surface-2 transition"
            onClick={onNew}
            aria-label="Restart with a new puzzle"
            title="Restart"
          >
            <RestartIcon />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-foreground active:bg-surface-2 transition"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <GearIcon />
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
          state={{ ...state, maxGuesses }}
          currentInput={input}
          certainDigits={certainDigits}
          lockedSlots={lockedSlots}
          pendingLockSlot={pendingLockSlot}
          onTapCell={tapCell}
          compact={session.digits === 6}
          preselectedDeck={preselectedDeck}
        />

        {error && <p className="text-bad text-xs text-center mt-2 shake">{error}</p>}

        <div className="mt-4">
          {/* Clue-param pickers: shown after the player picks a clue
              that requires a parameter selection before it resolves.
              Currently only Contains Digit (multi-pick) and Clue
              Reuse (which previously-used clue) need pickers. */}
          {pendingClueParam?.paramKind === "reuse" ? (
            <ReusePicker
              usedClueIds={state.guesses
                .map((g) => g.clueId)
                .filter(Boolean) as ClueId[]}
              onSelect={(clueId) =>
                confirmClueParam({ reusedClueId: clueId })
              }
              onCancel={cancelClueParam}
            />
          ) : pendingClueParam?.paramKind === "digit" && state.pendingGuess ? (
            <DigitPicker
              picks={pendingClueParam.picks ?? []}
              availableDigits={containsDigitAvailable(
                state.pendingGuess.guess,
                (pendingClueParam.picks ?? []).map((p) => p.digit),
              )}
              onPick={pickContainsDigit}
              onCancel={cancelClueParam}
            />
          ) : state.pendingGuess && !preselectedMode ? (
            <>
              {/* Unlimited renders the Redraw control inside the
                  ResourceBalance row below (so it sits on the same
                  line as the balance column) rather than as a full-
                  width button under the chooser cards. The chooser
                  itself just shows the two clue cards. */}
              <ClueChooser
                options={state.pendingGuess.options}
                onChoose={chooseClue}
                locksAvailable={locksAvailable}
                isRound1={state.guesses.length === 0}
              />
              <ResourceBalance
                lockBalance={hintLocks}
                advancedMode={advancedMode}
                hint={
                  canRedraw ? (
                    <button
                      type="button"
                      onClick={redraw}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Redraw (costs 🔒×1)
                    </button>
                  ) : (
                    ""
                  )
                }
              />
            </>
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
              <ResourceBalance
                lockBalance={hintLocks}
                advancedMode={advancedMode && !preselectedMode}
                hint={
                  lockMode ? (
                    unlockMode ? (
                      <span className="block">
                        Press Unlock to remove the lock.
                      </span>
                    ) : canCommitPendingLock ? (
                      <>
                        <span className="block">Press Lock to confirm</span>
                        <span className="block">
                          Or tap the slot again to cancel.
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block">
                          Pick a digit, then press Lock
                        </span>
                        <span className="block">
                          Or tap the lock again to cancel.
                        </span>
                      </>
                    )
                  ) : hintLocks > 0 ? (
                    <span className="block">Tap a cell to lock a digit.</span>
                  ) : (
                    ""
                  )
                }
              />
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
    </main>
  );
}

/** Inline SVG restart icon (Heroicons "arrow-path"). The broken-circle-
 *  with-arrow shape reads as "restart / reload" across platforms. */
function RestartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden
    >
      <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

