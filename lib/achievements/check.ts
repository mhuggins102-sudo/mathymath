"use client";

import {
  loadAchievements,
  recordAchievementCriterion,
  recordAchievementUnlock,
} from "@/lib/persistence/localStore";
import { ACHIEVEMENTS } from "./registry";
import type { AchievementCtx, AchievementUnlock } from "./types";

/** Run every detector against the just-resolved game and return the
 *  set of newly-unlocked (id, level) pairs. Persists each unlock as a
 *  side effect so the result is stable across reloads.
 *
 *  Two achievement schemas:
 *
 *  - **level1/level2**: classic "L1 then L2" — hopping straight to L2
 *    unlocks L1 too. Toast order in the returned array places L1 before
 *    L2 so the caller can show them in a natural sequence.
 *
 *  - **criteria**: silver = any one criterion newly met, gold = every
 *    criterion met. Detecting each criterion writes a stable per-
 *    criterion timestamp; the L1/L2 tiers are derived from how many
 *    criteria are total-now-met. */
export function runAchievementCheck(
  ctx: AchievementCtx,
): AchievementUnlock[] {
  const store = loadAchievements();
  const unlocks: AchievementUnlock[] = [];
  for (const ach of ACHIEVEMENTS) {
    const existing = store.unlocked[ach.id] ?? {};

    if (ach.criteria) {
      // Multi-criteria branch.
      const priorCriteria = { ...(existing.criteria ?? {}) };
      const nowCriteria: Record<string, boolean> = {};
      for (const cr of ach.criteria) {
        const alreadyMet = !!priorCriteria[cr.id];
        const meetsNow = alreadyMet || cr.detect(ctx);
        if (!alreadyMet && cr.detect(ctx)) {
          recordAchievementCriterion(ach.id, cr.id);
        }
        nowCriteria[cr.id] = meetsNow;
      }
      const metCount = Object.values(nowCriteria).filter(Boolean).length;
      const wasAnyMet = Object.keys(priorCriteria).length > 0;
      const allMetNow = metCount === ach.criteria.length;
      const allMetBefore =
        Object.keys(priorCriteria).length === ach.criteria.length;
      if (!wasAnyMet && metCount >= 1) {
        unlocks.push({ id: ach.id, level: 1 });
      }
      if (!allMetBefore && allMetNow) {
        unlocks.push({ id: ach.id, level: 2 });
      }
      continue;
    }

    // Classic L1/L2 branch.
    const l1 = ach.level1;
    const l2 = ach.level2;
    if (l2 && !existing.level2At && l2.detect(ctx)) {
      if (l1 && !existing.level1At) unlocks.push({ id: ach.id, level: 1 });
      unlocks.push({ id: ach.id, level: 2 });
      continue;
    }
    if (l1 && !existing.level1At && l1.detect(ctx)) {
      unlocks.push({ id: ach.id, level: 1 });
    }
  }
  // Persist L1/L2 unlocks. Criteria timestamps were already written
  // inside the loop. Level-1/2 timestamps for criteria-style
  // achievements come through here too so the modal's tier resolver
  // can read `level1At`/`level2At` uniformly.
  for (const u of unlocks) recordAchievementUnlock(u.id, u.level);
  return unlocks;
}
