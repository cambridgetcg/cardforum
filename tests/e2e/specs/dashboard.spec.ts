import { test, expect } from "../fixtures/auth.fixture";
import { DashboardPage } from "../pages/dashboard.page";

/**
 * Dashboard tests — verify stats cards, CTA links, and navigation.
 *
 * Dashboard uses React Query (useDashboard hook) for stats.
 * Stats are rendered with default 0 values before API resolves.
 */
test.describe("Dashboard", () => {
  test("shows stat cards with counts", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.navigate();
    await dashboard.assertWelcome();

    // 6 stat cards: Listings, Active Trades, Completed, Matches, Expert Posts, Collection
    // Each card has an h3 with the title and a text-3xl p with the count.
    // Use h3 headings to avoid ambiguity with nav links.
    await expect(authedPage.locator("h3").filter({ hasText: "Listings" })).toBeVisible();
    await expect(authedPage.locator("h3").filter({ hasText: "Active Trades" })).toBeVisible();
    await expect(authedPage.locator("h3").filter({ hasText: "Completed" })).toBeVisible();
    await expect(authedPage.locator("h3").filter({ hasText: "Matches" })).toBeVisible();
    await expect(authedPage.locator("h3").filter({ hasText: "Expert Posts" })).toBeVisible();
    await expect(authedPage.locator("h3").filter({ hasText: "Collection" })).toBeVisible();
  });

  test("shows CTA cards with links", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.navigate();

    // CTA links
    await expect(authedPage.getByRole("link", { name: /browse cards/i })).toBeVisible();
    await expect(authedPage.getByRole("link", { name: /visit expert hub/i })).toBeVisible();
  });

  test("navigates to listings from CTA", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.navigate();

    // The CTA card shows "Go to Listings" (when 0 listings) or "View Trades" (when >0)
    // For a new test user with 0 listings, it will be "Go to Listings"
    const listingsLink = authedPage.getByRole("link", { name: /go to listings/i }).first();
    await expect(listingsLink).toBeVisible();
    await listingsLink.click();
    await authedPage.waitForURL(/\/listings/, { timeout: 10_000 });

    expect(authedPage.url()).toMatch(/\/listings/);
  });
});
