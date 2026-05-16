"use client";

import { useEffect, useState } from "react";
import type { AchievementUnlock } from "@/lib/achievements/types";

/** Module-level event bus for achievement toasts. Both game hooks push
 *  into it at game end; the global `AchievementToastHost` subscribes
 *  and renders the current queue. */
type Listener = (queue: AchievementUnlock[]) => void;
const listeners = new Set<Listener>();
let queue: AchievementUnlock[] = [];

function emit() {
  for (const l of listeners) l(queue);
}

export function pushAchievementToasts(unlocks: AchievementUnlock[]): void {
  if (unlocks.length === 0) return;
  queue = [...queue, ...unlocks];
  emit();
}

export function dismissCurrentToast(): void {
  if (queue.length === 0) return;
  queue = queue.slice(1);
  emit();
}

/** Subscribe to the toast queue from a React component. Returns the
 *  full queue snapshot; the host typically renders only `queue[0]` and
 *  advances on timer / tap. */
export function useAchievementToastQueue(): AchievementUnlock[] {
  const [q, setQ] = useState<AchievementUnlock[]>(queue);
  useEffect(() => {
    const fn = (next: AchievementUnlock[]) => setQ(next);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return q;
}
