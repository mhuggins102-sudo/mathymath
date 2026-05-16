"use client";

import {
  loadAchievements,
  recordAchievementUnlock,
} from "@/lib/persistence/localStore";
import { ACHIEVEMENTS } from "./registry";
import type { AchievementCtx, AchievementUnlock } from "./types";

/** Run every detector against the just-resolved game and return the
 *  set of newly-unlocked (id, level) pairs. Persists each unlock as a
 *  side effect so the result is stable across reloads.
 *
 *  Hopping straight to L2 unlocks L1 too. Toast order in the returned
 *  array places L1 before L2 so the caller can show them in a
 *  natural sequence. */
export function runAchievementCheck(
  ctx: AchievementCtx,
): AchievementUnlock[] {
  const store = loadAchievements();
  const unlocks: AchievementUnlock[] = [];
  for (const ach of ACHIEVEMENTS) {
    const existing = store.unlocked[ach.id] ?? {};
    const l2 = ach.level2;
    if (l2 && !existing.level2At && l2.detect(ctx)) {
      if (!existing.level1At) unlocks.push({ id: ach.id, level: 1 });
      unlocks.push({ id: ach.id, level: 2 });
      continue;
    }
    if (!existing.level1At && ach.level1.detect(ctx)) {
      unlocks.push({ id: ach.id, level: 1 });
    }
  }
  // Persist all in one shot via successive idempotent writes. The
  // store-level read-then-write is fine for the achievement volumes
  // we're dealing with (≤ 30 unlocks per game in the absolute worst
  // case; typically 0-2).
  for (const u of unlocks) recordAchievementUnlock(u.id, u.level);
  return unlocks;
}
