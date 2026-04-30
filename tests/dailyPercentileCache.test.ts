import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Vitest's default environment is "node" (see vitest.config.ts), which
// has no `window` / `localStorage`. Polyfill a minimal in-memory
// localStorage on globalThis.window so the cache helpers — which
// short-circuit when `typeof window === "undefined"` — actually run.
const store = new Map<string, string>();
const memoryLocalStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
};

beforeAll(() => {
  (globalThis as unknown as { window: { localStorage: typeof memoryLocalStorage } }).window =
    { localStorage: memoryLocalStorage };
});

afterAll(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

beforeEach(() => {
  store.clear();
});

// Import AFTER the polyfill so the module's typeof-window check passes.
const {
  saveDailyPercentile,
  loadDailyPercentile,
} = await import("@/lib/persistence/localStore");

describe("daily percentile cache", () => {
  it("round-trips a percentile + aggregate via localStorage", () => {
    const value = {
      percentile: 73,
      aggregate: {
        total: 100,
        wins: 88,
        distribution: { "3": 10, "4": 30, "5": 48 },
      },
    };
    saveDailyPercentile("2026-04-30", value);
    const loaded = loadDailyPercentile("2026-04-30");
    expect(loaded).not.toBeNull();
    expect(loaded!.percentile).toBe(73);
    expect(loaded!.aggregate).toEqual(value.aggregate);
    expect(typeof loaded!.cachedAt).toBe("number");
  });

  it("returns null when nothing has been cached for the date", () => {
    expect(loadDailyPercentile("2026-04-30")).toBeNull();
  });

  it("scopes the cache per date — different dates don't collide", () => {
    saveDailyPercentile("2026-04-29", {
      percentile: 10,
      aggregate: { total: 1, wins: 1, distribution: { "5": 1 } },
    });
    saveDailyPercentile("2026-04-30", {
      percentile: 50,
      aggregate: { total: 2, wins: 2, distribution: { "4": 2 } },
    });
    expect(loadDailyPercentile("2026-04-29")!.percentile).toBe(10);
    expect(loadDailyPercentile("2026-04-30")!.percentile).toBe(50);
  });

  it("returns null when the cached blob is malformed", () => {
    // Simulate a corrupted localStorage value (e.g. left over from a
    // previous schema version or hand-edited). The loader should
    // gracefully drop it instead of throwing.
    store.set("mathymath:dailyPercentile:2026-04-30", "{not json}");
    expect(loadDailyPercentile("2026-04-30")).toBeNull();
    store.set(
      "mathymath:dailyPercentile:2026-04-30",
      JSON.stringify({ version: 1, percentile: "not a number" }),
    );
    expect(loadDailyPercentile("2026-04-30")).toBeNull();
  });

  it("overwrites a stale cache on re-save (newer leaderboard data wins)", () => {
    saveDailyPercentile("2026-04-30", {
      percentile: 25,
      aggregate: { total: 4, wins: 4, distribution: { "5": 4 } },
    });
    const firstAt = loadDailyPercentile("2026-04-30")!.cachedAt;
    // Force a different millisecond reading by waiting a tick (cachedAt
    // uses Date.now()). A trivial spin-wait — we only need the value
    // to differ to confirm the cache really updated, and one ms is
    // plenty in any realistic environment.
    while (Date.now() === firstAt) {
      /* spin */
    }
    saveDailyPercentile("2026-04-30", {
      percentile: 60,
      aggregate: { total: 10, wins: 9, distribution: { "4": 5, "5": 4 } },
    });
    const second = loadDailyPercentile("2026-04-30")!;
    expect(second.percentile).toBe(60);
    expect(second.cachedAt).toBeGreaterThan(firstAt);
  });
});
