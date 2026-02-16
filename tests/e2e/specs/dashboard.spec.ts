import { test, expect } from "../fixtures/auth.fixture";
import { DashboardPage } from "../pages/dashboard.page";

/**
 * Dashboard tests — verify stats cards, CTA links, and navigation.
 */
test.describe("Dashboard", () => {
  test("shows stat cards with counts", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.navigate();
    await dashboard.assertWelcome();

    // 6 stat cards should be visible
    await expect(authedPage.getByText("Listings")).toBeVisible();
    await expect(authedPage.getByText("Active Trades")).toBeVisible();
    await expect(authedPage.getByText("Completed")).toBeVisible();
    await expect(authedPage.getByText("Matches")).toBeVisible();
    await expect(authedPage.getByText("Expert Posts")).toBeVisible();
    await expect(authedPage.getByText("Collection")).toBeVisible();
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

    const listingsLink = authedPage.getByRole("link", { name: /go to listings|view trades/i }).first();
    await expect(listingsLink).toBeVisible();
    await listingsLink.click();
    await authedPage.waitForLoadState("domcontentloaded");

    expect(authedPage.url()).toMatch(/\/(listings|trades)/);
  });
});
