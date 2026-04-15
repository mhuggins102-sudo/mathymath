import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // scripts/**/*.test.ts are gated by env vars inside the test body
    // (see scripts/sim.test.ts) so they don't run in the default `pnpm
    // test` suite. `pnpm sim` sets RUN_SIM=1 to opt in.
    include: ["tests/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
