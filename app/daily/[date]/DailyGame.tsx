"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDailyGame } from "@/lib/hooks/useDailyGame";
import { useClientId } from "@/lib/hooks/useClientId";
import { GuessGrid } from "@/components/GuessGrid";
import { Keypad } from "@/components/Keypad";
import { ClueChooser } from "@/components/ClueChooser";
import { HelpModal } from "@/components/HelpModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { LifetimeStatsModal } from "@/components/LifetimeStatsModal";
import {
  DailyResultPanel,
  type DailyPercentileData,
} from "@/components/DailyResultPanel";
import { Modal } from "@/components/Modal";
import { buildShareText } from "@/lib/game/share";
import { recordDailyResult } from "@/lib/persistence/localStore";

interface DailyGameProps {
  date: string;
  isToday: boolean;
  digits: number;
  maxGuesses: number;
}

export function DailyGame({
  date,
  isToday,
  digits,
  maxGuesses,
}: DailyGameProps) {
  const clientId = useClientId();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  // Result popup auto-opens when the game is (or becomes) terminal. The
  // player can dismiss with "show puzzle" to see the detailed grid, or
  // tap 🏆 in the header to re-open.
  const [resultsPopupOpen, setResultsPopupOpen] = useState(false);
  // Tracks whether the popup has been auto-opened once for this mount.
  const autoPoppedRef = useRef(false);
  const [percentile, setPercentile] = useState<DailyPercentileData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const personalRecordedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());

  const game = useDailyGame({
    date,
    digits,
    maxGuesses,
    storageKey: `daily:${date}`,
  });

  const {
    state,
    input,
    error,
    appendDigit,
    backspace,
    submit,
    chooseClue,
    hydrated,
    loading,
    certainDigits,
    inputCapacity,
    lockedSlots,
    pendingLockSlot,
    locksAvailable,
    canCommitPendingLock,
    tapCell,
    commitLock,
  } = game;

  const keypadDisabled =
    state.status !== "playing" || !!state.pendingGuess || loading;
  // Submit requires all non-certain non-locked slots to be typed AND no
  // lock still pending (must be committed or cancelled first).
  const submitDisabled =
    input.length !== inputCapacity ||
    pendingLockSlot !== null ||
    keypadDisabled;
  const lockMode = pendingLockSlot !== null;

  // Record this daily's result locally (first write wins per date). This
  // feeds the Lifetime Stats view on the home page — it's not shown on the
  // daily end screen itself.
  useEffect(() => {
    if (!hydrated) return;
    if (state.status === "playing") return;
    if (personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordDailyResult(date, state.guesses.length, state.status === "won");
  }, [hydrated, state.status, state.guesses.length, date]);

  // Auto-open the results popup once when the game enters terminal state
  // (either on arrival for an already-played daily, or the moment the
  // player resolves today's puzzle).
  useEffect(() => {
    if (!hydrated) return;
    if (state.status === "playing") return;
    if (autoPoppedRef.current) return;
    autoPoppedRef.current = true;
    setResultsPopupOpen(true);
  }, [hydrated, state.status]);

  useEffect(() => {
    if (!hydrated) return;
    if (state.status === "playing") return;
    if (!clientId) return;
    if (submittedRef.current) return;
    submittedRef.current = true;

    setStatsLoading(true);
    setStatsError(null);

    // Results endpoint now receives the full history so the server can
    // re-validate against the real target (integrity gate). The
    // derived {won, guessCount, chosenClues} are computed server-side.
    const payload = {
      clientId,
      puzzleDate: date,
      history: state.guesses.map((g) => ({
        guess: g.guess,
        clueId: g.clueId,
        result: g.result,
      })),
      durationMs: Date.now() - startedAtRef.current,
    };

    fetch("/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "server_error");
        setPercentile({ percentile: j.percentile, aggregate: j.aggregate });
      })
      .catch((e: Error) => setStatsError(e.message))
      .finally(() => setStatsLoading(false));
  }, [hydrated, state.status, state.guesses, clientId, date]);

  const handleShare = useCallback(async () => {
    const text = buildShareText({
      title: `mathymath ${date}`,
      won: state.status === "won",
      guessCount: state.guesses.length,
      maxGuesses: state.maxGuesses,
      digits: state.digits,
      // buildShareText expects ResolvedGuess[]; DailyGameState guesses
      // match that structurally (guess + clueId + result).
      guesses: state.guesses,
    });
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator & { share: (d: { text: string }) => Promise<void> }).share({ text });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch {
      prompt("Copy:", text);
    }
  }, [date, state]);

  const statusLabel = useMemo(() => {
    if (!isToday) return `Daily — ${date}`;
    return "Today";
  }, [isToday, date]);

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-3 pt-3 pb-6">
      <header className="flex items-center justify-between mb-3">
        <Link
          href={isToday ? "/" : "/archive"}
          className="text-muted text-sm hover:text-foreground"
        >
          ← {isToday ? "home" : "back"}
        </Link>
        <h1 className="text-sm uppercase tracking-wider text-muted">{statusLabel}</h1>
        <div className="flex items-center gap-0.5">
          {state.status !== "playing" && (
            <button
              type="button"
              className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted text-base hover:text-foreground active:bg-surface-2 transition"
              onClick={() => setResultsPopupOpen(true)}
              aria-label="Show results"
              title="Show results"
            >
              🏆
            </button>
          )}
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
            aria-label="Daily stats"
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
        {error && (
          <p className="text-bad text-xs text-center mt-2 shake">{error}</p>
        )}
        {state.status === "playing" && !state.pendingGuess && (
          <p className="text-[10px] text-muted text-center mt-2">
            {lockMode
              ? "Pick a digit for the highlighted slot, then press Lock — or tap the slot again to cancel."
              : locksAvailable > 0
              ? `🔒 ${locksAvailable} lock${locksAvailable === 1 ? "" : "s"} available${state.guesses.length === 0 ? " (usable from guess 2)" : " — tap a cell to use"}`
              : ""}
          </p>
        )}
        {state.status === "playing" && (
          <div className="mt-4">
            {state.pendingGuess ? (
              <ClueChooser
                options={state.pendingGuess.options}
                onChoose={chooseClue}
              />
            ) : (
              <Keypad
                onDigit={appendDigit}
                onBackspace={backspace}
                onSubmit={submit}
                disabled={keypadDisabled}
                submitDisabled={submitDisabled}
                lockMode={lockMode}
                onLockCommit={commitLock}
                lockCommitDisabled={!canCommitPendingLock}
              />
            )}
          </div>
        )}
      </div>

      {/* Result popup: overlays the page when the game is terminal. The
          player taps "show puzzle" to dismiss it and inspect their grid,
          or 🏆 in the header to re-open. */}
      <Modal
        open={state.status !== "playing" && resultsPopupOpen}
        onClose={() => setResultsPopupOpen(false)}
        ariaLabel={state.status === "won" ? "You won" : "Out of guesses"}
        variant="overlay"
      >
        <DailyResultPanel
          won={state.status === "won"}
          guessCount={state.guesses.length}
          target={state.revealedTarget ?? ""}
          data={percentile}
          loading={statsLoading}
          error={statsError}
          maxGuesses={state.maxGuesses}
          onShare={handleShare}
          onDismiss={() => setResultsPopupOpen(false)}
        />
      </Modal>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LifetimeStatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        mode="daily"
      />
    </main>
  );
}
