"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { TrophyIcon, type TrophyTier } from "./TrophyIcon";
import {
  ACHIEVEMENTS,
  TOTAL_UNLOCK_SLOTS,
} from "@/lib/achievements/registry";
import type { Achievement } from "@/lib/achievements/types";
import {
  loadAchievements,
  type AchievementsStore,
} from "@/lib/persistence/localStore";

interface AchievementsModalProps {
  open: boolean;
  onClose: () => void;
}

/** Resolve the trophy tier shown for an achievement given the player's
 *  unlock state. Single-level achievements skip silver — their first
 *  (and only) unlock awards gold directly. Criteria-style achievements
 *  always have two tiers (silver / gold). */
function trophyTierFor(
  ach: Achievement,
  unlock: AchievementsStore["unlocked"][string] | undefined,
): TrophyTier {
  const l1 = Boolean(unlock?.level1At);
  const l2 = Boolean(unlock?.level2At);
  if (l2) return "gold";
  if (l1) return ach.criteria || ach.level2 ? "silver" : "gold";
  return "locked";
}

export function AchievementsModal({ open, onClose }: AchievementsModalProps) {
  const [store, setStore] = useState<AchievementsStore | null>(null);
  // Single-open achievement — clicking another card collapses the
  // previous one. Local to the current modal session; resets to null
  // on every modal-open.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStore(loadAchievements());
    setExpandedId(null);
  }, [open]);

  let unlockedCount = 0;
  if (store) {
    for (const ach of ACHIEVEMENTS) {
      const u = store.unlocked[ach.id];
      if (!u) continue;
      if (u.level1At) unlockedCount += 1;
      if (u.level2At) unlockedCount += 1;
    }
  }

  const titleId = "achievements-title";

  return (
    <Modal open={open} onClose={onClose} titleId={titleId} variant="overlay">
      <div className="bg-surface rounded-xl border border-border shadow-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 id={titleId} className="text-base font-semibold">
            Achievements
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-center min-h-11 px-3 rounded-md text-muted hover:text-foreground active:bg-surface-2 text-sm"
            onClick={onClose}
          >
            Close ✕
          </button>
        </div>
        <p className="text-xs text-muted mb-3">
          {unlockedCount} of {TOTAL_UNLOCK_SLOTS} unlocked
        </p>
        <ul className="space-y-2">
          {ACHIEVEMENTS.map((ach) => {
            const u = store?.unlocked[ach.id];
            const tier = trophyTierFor(ach, u);
            const isExpanded = expandedId === ach.id;
            const toggle = () =>
              setExpandedId((cur) => (cur === ach.id ? null : ach.id));
            return (
              <li
                key={ach.id}
                className="rounded-lg border border-border bg-surface-2 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={isExpanded}
                  aria-label={`${
                    isExpanded ? "Hide" : "Show"
                  } details for ${ach.name}`}
                  className="w-full text-left p-3 hover:bg-surface-2/60 active:bg-surface-2/40 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <TrophyIcon tier={tier} size="md" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                      {ach.name}
                    </h3>
                    <span
                      aria-hidden
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border text-muted text-xs font-semibold shrink-0"
                    >
                      i
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 pl-10 text-xs space-y-1">
                      <p className="text-muted leading-snug">
                        {ach.description}
                      </p>
                      {ach.criteria ? (
                        <CriteriaList ach={ach} unlock={u} />
                      ) : (
                        <>
                          {ach.level1 && (
                            <p className="text-foreground leading-snug">
                              <span className="font-medium text-slate-300">
                                {ach.level2 ? "Silver:" : "Gold:"}
                              </span>{" "}
                              {ach.level1.label}
                            </p>
                          )}
                          {ach.level2 && (
                            <p className="text-foreground leading-snug">
                              <span className="font-medium text-amber-400">
                                Gold:
                              </span>{" "}
                              {ach.level2.label}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

/** Per-criterion list shown in the modal popup for criteria-style
 *  achievements. Each row shows the criterion name with a dot
 *  indicating its status: silver if met (and the achievement isn't
 *  fully gold yet), gold if met when the achievement is gold, muted —
 *  if not yet earned. */
function CriteriaList({
  ach,
  unlock,
}: {
  ach: Achievement;
  unlock: AchievementsStore["unlocked"][string] | undefined;
}) {
  const tier = trophyTierFor(ach, unlock);
  const metMap = unlock?.criteria ?? {};
  return (
    <div className="text-foreground leading-snug">
      <p>
        <span className="font-medium text-slate-300">Earn any one:</span>{" "}
        silver. Earn all → gold.
      </p>
      <ul className="mt-1 space-y-1">
        {(ach.criteria ?? []).map((cr) => {
          const met = !!metMap[cr.id];
          const dotClass = met
            ? tier === "gold"
              ? "text-amber-400"
              : "text-slate-300"
            : "text-muted";
          return (
            <li key={cr.id} className="flex items-start gap-2">
              <span aria-hidden className={`shrink-0 ${dotClass}`}>
                {met ? "●" : "○"}
              </span>
              <span className={met ? "text-foreground" : "text-muted"}>
                {cr.name}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
