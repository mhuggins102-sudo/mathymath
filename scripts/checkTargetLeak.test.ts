import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generateDailyTarget, todayUtcISO } from "@/lib/game/targetGenerator";

// Runs only when RUN_LEAK_CHECK=1. Reads /tmp/daily.html (captured by
// an outer script that curled the rendered page) and asserts the real
// daily target does not appear anywhere.
describe.skipIf(process.env.RUN_LEAK_CHECK !== "1")(
  "daily HTML leak check",
  () => {
    it("does not contain today's target anywhere", () => {
      const today = todayUtcISO();
      const target = generateDailyTarget(today, 5);
      const html = readFileSync("/tmp/daily.html", "utf8");
      console.log(`  today=${today}  target=${target}  html bytes=${html.length}`);
      // Main check: literal target substring.
      expect(html.includes(target)).toBe(false);
      // Also check a few JSON-escaped variants (defensive; the React
      // payload would serialize strings plainly).
      expect(html.includes(JSON.stringify(target))).toBe(false);
    });
  },
);
