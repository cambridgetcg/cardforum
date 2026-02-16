import { test, expect } from "../fixtures/auth.fixture";
import { LoginPage } from "../pages/login.page";
import { BrowsePage } from "../pages/browse.page";
import { DashboardPage } from "../pages/dashboard.page";

/**
 * Smoke tests — verify core pages load and auth gating works.
 *
 * These run first and fast. If smoke fails, deeper tests won't help.
 * Pattern: navigate → assert visible → assert no console errors.
 */
test.describe("Smoke Tests", () => {
  test("homepage redirects to login or loads", async ({ page }) => {
    await page.goto("/");
    // Homepage should be accessible (no auth required for /)
    await expect(page).toHaveTitle(/CardForum/i);
  });

  test("unauthenticated user is redirected to login from protected routes", async ({ browser }) => {
    // Create a fresh context with explicitly empty storage state to ensure no auth cookies
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    // Protected routes should redirect to /login with callbackUrl.
    // The middleware returns a 307 redirect, which Playwright follows.
    // After goto resolves, the URL should already be /login.
    await page.goto("http://localhost:3000/dashboard");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");

    await page.goto("http://localhost:3000/wallet");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");

    await page.goto("http://localhost:3000/trades");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");

    await context.close();
  });

  test("authenticated user can access dashboard", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.navigate();
    await dashboard.assertWelcome();
  });

  test("browse page loads with set catalog", async ({ authedPage }) => {
    const browse = new BrowsePage(authedPage);
    await browse.navigate();
    await browse.assertHeading("Browse Cards");
  });

  test("login page renders", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://localhost:3000/login");
    await page.waitForLoadState("domcontentloaded");

    // Login heading is "Welcome back" (from login-form.tsx:47)
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    // Form has email and password placeholders (not labels — they use placeholder, not <label>)
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    await context.close();
  });
});
