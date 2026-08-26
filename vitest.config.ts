import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/tantu/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // Rendering 40-odd components with axe on each is not fast; give the
    // whole-surface sweep room rather than tuning per-test timeouts.
    testTimeout: 20000,
    restoreMocks: true,
  },
});
