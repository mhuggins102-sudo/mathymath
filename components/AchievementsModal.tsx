"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { TrophyIcon } from "./TrophyIcon";
import {
  ACHIEVEMENTS,
  TOTAL_UNLOCK_SLOTS,
} from "@/lib/achievements/registry";
import {
  loadAchievements,
  type AchievementsStore,
} from "@/lib/persistence/localStore";

interface AchievementsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AchievementsModal({ open, onClose }: AchievementsModalProps) {
  const [store, setStore] = useState<AchievementsStore | null>(null);

  useEffect(() => {
    if (!open) return;
    setStore(loadAchievements());
  }, [open]);

  // Count unlocked slots (each level counts independently). Single-
  // level achievements contribute 0 or 1; dual-level contribute 0-2.
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
            const l1 = Boolean(u?.level1At);
            const l2 = Boolean(u?.level2At);
            return (
              <li
                key={ach.id}
                className="flex gap-3 items-start rounded-lg border border-border bg-surface-2 p-3"
              >
                <div className="shrink-0 pt-0.5">
                  <TrophyIcon
                    tier={l2 ? "gold" : l1 ? "bronze" : "locked"}
                    size="lg"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {ach.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted mt-0.5 leading-snug">
                    {ach.description}
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    <LevelRow
                      tier={l1 ? "bronze" : "locked"}
                      labelPrefix="Level 1"
                      label={ach.level1.label}
                    />
                    {ach.level2 && (
                      <LevelRow
                        tier={l2 ? "gold" : "locked"}
                        labelPrefix="Level 2"
                        label={ach.level2.label}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

function LevelRow({
  tier,
  labelPrefix,
  label,
}: {
  tier: "locked" | "bronze" | "gold";
  labelPrefix: string;
  label: string;
}) {
  const dotClass =
    tier === "gold"
      ? "bg-amber-400"
      : tier === "bronze"
        ? "bg-amber-700"
        : "bg-muted/30";
  const textClass = tier === "locked" ? "text-muted" : "text-foreground";
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-1 inline-block w-2 h-2 rounded-full shrink-0 ${dotClass}`}
        aria-hidden
      />
      <span className={`${textClass} leading-snug`}>
        <span className="font-medium">{labelPrefix}:</span> {label}
      </span>
    </div>
  );
}
