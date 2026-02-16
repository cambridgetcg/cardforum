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

  test("unauthenticated user is redirected to login from protected routes", async ({
    browser,
  }) => {
    // Create a fresh context without auth cookies
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginPage = new LoginPage(page);

    await page.goto("/dashboard");
    await loginPage.assertRedirectedFrom("/dashboard");

    await page.goto("/wallet");
    await loginPage.assertRedirectedFrom("/wallet");

    await page.goto("/trades");
    await loginPage.assertRedirectedFrom("/trades");

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
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    await context.close();
  });
});
