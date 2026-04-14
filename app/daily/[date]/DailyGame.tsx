"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGame } from "@/lib/hooks/useGame";
import { useClientId } from "@/lib/hooks/useClientId";
import { GuessGrid } from "@/components/GuessGrid";
import { Keypad } from "@/components/Keypad";
import { ClueChooser } from "@/components/ClueChooser";
import { HelpModal } from "@/components/HelpModal";
import {
  DailyResultPanel,
  type DailyPercentileData,
} from "@/components/DailyResultPanel";
import { buildShareText } from "@/lib/game/share";

interface DailyGameProps {
  date: string;
  target: string;
  isToday: boolean;
  digits: number;
  maxGuesses: number;
}

export function DailyGame({
  date,
  target,
  isToday,
  digits,
  maxGuesses,
}: DailyGameProps) {
  const clientId = useClientId();
  const [helpOpen, setHelpOpen] = useState(false);
  const [percentile, setPercentile] = useState<DailyPercentileData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());

  const game = useGame({
    target,
    seed: date,
    digits,
    maxGuesses,
    storageKey: `daily:${date}`,
    trackStats: false,
  });

  const { state, input, error, appendDigit, backspace, submit, chooseClue, hydrated } =
    game;

  const keypadDisabled = state.status !== "playing" || !!state.pendingGuess;
  const submitDisabled = input.length !== state.digits || keypadDisabled;

  useEffect(() => {
    if (!hydrated) return;
    if (state.status === "playing") return;
    if (!clientId) return;
    if (submittedRef.current) return;
    submittedRef.current = true;

    setStatsLoading(true);
    setStatsError(null);

    const payload = {
      clientId,
      puzzleDate: date,
      guessCount: state.guesses.length,
      won: state.status === "won",
      chosenClues: state.guesses.map((g, i) => ({ guessIdx: i, clueId: g.clueId })),
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
        <Link href="/" className="text-muted text-sm hover:text-foreground">
          ← home
        </Link>
        <h1 className="text-sm uppercase tracking-wider text-muted">{statusLabel}</h1>
        <button
          type="button"
          className="text-muted text-sm hover:text-foreground px-2"
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
        >
          ?
        </button>
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
            <div className="space-y-3">
              <DailyResultPanel
                won={state.status === "won"}
                guessCount={state.guesses.length}
                target={state.target}
                data={percentile}
                loading={statsLoading}
                error={statsError}
                maxGuesses={state.maxGuesses}
                onShare={handleShare}
              />
              {!isToday && (
                <p className="text-center text-xs text-muted">
                  <Link href="/archive" className="underline">
                    ← Back to archive
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
