import { defineConfig } from "@playwright/test";
import baseConfig from "../../playwright.config";

/**
 * Debug configuration — overrides base config for interactive debugging.
 *
 * Usage: npx playwright test --config tests/e2e/debug.config.ts
 *
 * Differences from base:
 *   - Headed mode (visible browser)
 *   - Always capture trace + video (not just on failure)
 *   - Auto-open HTML report on failure
 *   - Zero retries (fail fast in debug loop)
 *   - Slower timeout for manual inspection
 */
export default defineConfig({
  ...baseConfig,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,

  reporter: [
    ["list"],
    ["html", { open: "on-failure" }],
  ],

  use: {
    ...baseConfig.use,
    headless: false,
    trace: "on",
    screenshot: "on",
    video: "on",
    launchOptions: {
      slowMo: 250, // Slow down actions for visual tracking
    },
  },
});
