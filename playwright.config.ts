import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env file for DATABASE_URL, AUTH_SECRET, etc.
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * Playwright E2E test configuration.
 *
 * Key design decisions:
 *   - fullyParallel: false — shared DB client (same as vitest.config.ts:13)
 *   - workers: 1 — prevents DB race conditions
 *   - storageState in "chromium" project — pre-authenticated session from setup
 *   - webServer starts `npm run dev` unless already running
 *
 * Usage:
 *   npm run test:e2e          — headless run
 *   npm run test:e2e:ui       — interactive UI mode
 *   npm run test:e2e:debug    — step-through debugging
 *   npm run test:e2e:headed   — visible browser
 */
export default defineConfig({
  testDir: "./tests/e2e/specs",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Setup project: creates test user + session cookie
    {
      name: "setup",
      testDir: "./tests/e2e",
      testMatch: /global-setup\.ts/,
      teardown: "teardown",
    },
    // Teardown project: cleans up test data
    {
      name: "teardown",
      testDir: "./tests/e2e",
      testMatch: /global-teardown\.ts/,
    },
    // Main test project: runs with pre-authenticated session
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
