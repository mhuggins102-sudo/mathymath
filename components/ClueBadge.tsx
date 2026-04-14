"use client";

import type { ClueResult, Cmp } from "@/lib/game/clues/types";
import { getClueById } from "@/lib/game/clues/registry";

interface ClueBadgeProps {
  result: ClueResult;
  guess: string;
}

const cmpChar = (c: Cmp) => (c === "eq" ? "=" : c === "gt" ? "↑" : "↓");
const cmpColor = (c: Cmp) =>
  c === "eq" ? "text-good" : c === "gt" ? "text-accent" : "text-warn";

const THERM_EMOJI = ["🔥", "🟧", "🟨", "🟦", "🧊"];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-wider text-muted">{children}</span>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 flex-wrap">{children}</div>;
}

export function ClueBadge({ result, guess }: ClueBadgeProps) {
  const clue = getClueById(result.kind);

  switch (result.kind) {
    case "bullseyes": {
      const n = result.hits.filter(Boolean).length;
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            {result.hits.map((hit, i) => (
              <span
                key={i}
                className={`font-mono text-base ${
                  hit ? "text-good" : "text-muted"
                }`}
              >
                {hit ? "🎯" : "·"}
              </span>
            ))}
            <span className="text-muted text-xs">{n}/5 exact</span>
          </PillRow>
        </div>
      );
    }

    case "higherLower": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            {result.cmp.map((c, i) => (
              <span key={i} className={`font-mono text-base ${cmpColor(c)}`}>
                {cmpChar(c)}
              </span>
            ))}
            <span className="text-muted text-xs">target vs your digit</span>
          </PillRow>
        </div>
      );
    }

    case "within2": {
      const n = result.mask.filter(Boolean).length;
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            {result.mask.map((m, i) => (
              <span
                key={i}
                className={`font-mono text-base ${
                  m ? "text-good" : "text-muted"
                }`}
              >
                {m ? "◎" : "·"}
              </span>
            ))}
            <span className="text-muted text-xs">{n} within ±2</span>
          </PillRow>
        </div>
      );
    }

    case "parityMask": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            {result.matches.map((m, i) => (
              <span
                key={i}
                className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                  m
                    ? "bg-good/20 text-good"
                    : "bg-bad/15 text-bad"
                }`}
              >
                {Number(guess[i]) % 2 === 0 ? "E" : "O"}
              </span>
            ))}
          </PillRow>
        </div>
      );
    }

    case "oracle": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            <span className="text-muted text-xs">slot {result.slot + 1}:</span>
            <span
              className={`digit-${result.digit} font-mono font-bold text-xl`}
            >
              {result.digit}
            </span>
          </PillRow>
        </div>
      );
    }

    case "thermometer": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            {result.tier.map((t, i) => (
              <span key={i} className="text-base">{THERM_EMOJI[t]}</span>
            ))}
          </PillRow>
        </div>
      );
    }

    case "sumDirection": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            <span className={`font-mono text-base ${cmpColor(result.cmp)}`}>
              target sum {cmpChar(result.cmp)} yours
            </span>
          </PillRow>
        </div>
      );
    }

    case "sumDelta": {
      const sign = result.delta > 0 ? "+" : "";
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            <span
              className={`font-mono text-base ${
                result.delta === 0
                  ? "text-good"
                  : result.delta > 0
                  ? "text-accent"
                  : "text-warn"
              }`}
            >
              {sign}
              {result.delta}
            </span>
            <span className="text-muted text-xs">target − your sum</span>
          </PillRow>
        </div>
      );
    }

    case "digitOverlap": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            <span className="font-mono text-base text-accent">
              {result.count}
            </span>
            <span className="text-muted text-xs">shared digits</span>
          </PillRow>
        </div>
      );
    }

    case "parityBalance": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded ${
                result.match
                  ? "bg-good/20 text-good"
                  : "bg-bad/15 text-bad"
              }`}
            >
              {result.match ? "even-count matches" : "even-count differs"}
            </span>
          </PillRow>
        </div>
      );
    }

    case "primeCount": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded ${
                result.match
                  ? "bg-good/20 text-good"
                  : "bg-bad/15 text-bad"
              }`}
            >
              {result.match ? "prime-count matches" : "prime-count differs"}
            </span>
          </PillRow>
        </div>
      );
    }

    case "rangeCompare": {
      return (
        <div className="text-sm">
          <Label>{clue.name}</Label>
          <PillRow>
            <span className={`font-mono text-base ${cmpColor(result.cmp)}`}>
              target {cmpChar(result.cmp)} your number
            </span>
          </PillRow>
        </div>
      );
    }
  }
}
