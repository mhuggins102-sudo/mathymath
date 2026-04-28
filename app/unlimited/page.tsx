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
import { SlotPicker, DigitPicker, ReusePicker } from "@/components/CluePickers";
import { HelpModal } from "@/components/HelpModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { LifetimeStatsModal } from "@/components/LifetimeStatsModal";
import { loadSettings } from "@/lib/settings";
import {
  loadUnlimitedMode,
  saveUnlimitedMode,
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
}

/** Resolves the chosen mode to a concrete digit count for the next
 *  game. "mix" randomizes per game with even odds between 5 and 6. */
function resolveDigits(mode: UnlimitedMode): number {
  if (mode === "5") return 5;
  if (mode === "6") return 6;
  return Math.random() < 0.5 ? 5 : 6;
}

function newSession(mode: UnlimitedMode): Session {
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
  };
}

export default function UnlimitedPage() {
  const [mode, setMode] = useState<UnlimitedMode>("5");
  const [session, setSession] = useState<Session | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // Hydrate the saved mode preference on first paint, then start the
  // first session against it. Same effect so we don't kick off a 5-digit
  // game and immediately replace it with the preferred shape on the
  // next render.
  useEffect(() => {
    const saved = loadUnlimitedMode();
    setMode(saved);
    setSession(newSession(saved));
  }, []);

  const handleModeChange = (next: UnlimitedMode) => {
    setMode(next);
    saveUnlimitedMode(next);
    // Start a fresh session in the new mode immediately. This discards
    // any in-progress game — acceptable for unlimited (no persisted
    // state). The key on UnlimitedGame remounts the reducer.
    setSession(newSession(next));
  };

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
      mode={mode}
      onModeChange={handleModeChange}
      onNew={() => setSession(newSession(mode))}
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
  mode,
  onModeChange,
  onNew,
  helpOpen,
  setHelpOpen,
  settingsOpen,
  setSettingsOpen,
  statsOpen,
  setStatsOpen,
}: {
  session: Session;
  mode: UnlimitedMode;
  onModeChange: (next: UnlimitedMode) => void;
  onNew: () => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  statsOpen: boolean;
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
    redraw,
    canRedraw,
    tapCell,
    commitLock,
    advancedMode,
    effectivePositionalCount,
    advancedPositionalCap,
    positionalCapReached,
    advancedReusePoolEmpty,
  } = useGame({
    target: session.target,
    seed: session.seed,
    digits: session.digits,
    maxGuesses,
    trackStats: true,
    advancedMode: session.advancedMode,
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

      <ModeSelector mode={mode} onChange={onModeChange} />

      {/* Advanced-mode indicator: shows the player's positional progress
          toward the 2-clue cap. Hidden in standard mode and on terminal
          states (no more picks to make). The "cap reached" copy fades to
          good after the second pick so the player knows what to expect
          next. */}
      {advancedMode && state.status === "playing" && (
        <p
          className={`text-[11px] text-center mb-2 ${
            positionalCapReached ? "text-good" : "text-muted"
          }`}
          aria-live="polite"
        >
          Advanced — Positional {effectivePositionalCount}/{advancedPositionalCap}
          {positionalCapReached ? " · cap reached" : ""}
        </p>
      )}

      <div className="flex-1 flex flex-col">
        <GuessGrid
          state={state}
          currentInput={input}
          certainDigits={certainDigits}
          lockedSlots={lockedSlots}
          pendingLockSlot={pendingLockSlot}
          onTapCell={tapCell}
          compact={session.digits === 6}
        />

        {error && <p className="text-bad text-xs text-center mt-2 shake">{error}</p>}

        <div className="mt-4">
          {/* Clue-param pickers: shown after the player picks a clue
              that requires a slot (Oracle) or digit (Contains Digit)
              selection before it resolves. */}
          {pendingClueParam?.paramKind === "slot" ? (
            <SlotPicker
              digits={session.digits}
              certainDigits={certainDigits}
              compact={session.digits === 6}
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
              excludePositional={positionalCapReached}
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
              locksAvailable={locksAvailable}
              reusePoolEmpty={advancedReusePoolEmpty}
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
                  ? `🔒 ${hintLocks} lock${hintLocks === 1 ? "" : "s"} available — tap a cell to use`
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

/** Three-way segmented control for picking the unlimited variant.
 *  Mode "mix" rerolls between 5 and 6 each new puzzle (50% / 50%). */
function ModeSelector({
  mode,
  onChange,
}: {
  mode: UnlimitedMode;
  onChange: (next: UnlimitedMode) => void;
}) {
  const options: { value: UnlimitedMode; label: string }[] = [
    { value: "5", label: "5-digit" },
    { value: "6", label: "6-digit" },
    { value: "mix", label: "Mix" },
  ];
  return (
    <div className="mb-3">
      <div
        role="radiogroup"
        aria-label="Game length"
        className="grid grid-cols-3 gap-1 bg-surface-2 rounded-md p-1"
      >
        {options.map((opt) => {
          const selected = mode === opt.value;
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
