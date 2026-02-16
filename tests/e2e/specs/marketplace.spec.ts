import { test, expect } from "../fixtures/auth.fixture";
import { MarketplacePage } from "../pages/marketplace.page";

/**
 * Marketplace tests — verify search, filters, card grid.
 *
 * Marketplace page uses raw fetch() with debounced search (300ms).
 * Initial load calls search("", "", "", 1) and the TCG filter useEffect.
 */
test.describe("Marketplace", () => {
  test("marketplace page loads with search and filters", async ({ authedPage }) => {
    const market = new MarketplacePage(authedPage);
    await market.navigate();
    await market.assertHeading("Marketplace");
    await market.assertSearchVisible();
    await market.assertTCGFilters();
  });

  test("shows market data after API response", async ({ authedPage }) => {
    const market = new MarketplacePage(authedPage);
    await market.navigate();

    // Wait for market data to load (either cards or "No active listings")
    await authedPage.waitForLoadState("networkidle");

    const hasCards = await authedPage.locator("a[href^='/marketplace/']").count();
    if (hasCards > 0) {
      await expect(authedPage.locator("a[href^='/marketplace/']").first()).toBeVisible();
    } else {
      await expect(authedPage.getByText(/no active listings/i)).toBeVisible();
    }
  });

  test("search filters cards", async ({ authedPage }) => {
    const market = new MarketplacePage(authedPage);
    await market.navigate();

    // Wait for initial load
    await authedPage.waitForLoadState("networkidle");

    // Set up response listener BEFORE typing search
    const searchPromise = authedPage.waitForResponse(
      (r) => r.url().includes("/api/marketplace") && r.url().includes("query=Luffy"),
      { timeout: 10_000 },
    );

    await market.search("Luffy");
    await searchPromise;

    // Results should be visible or show no results
    await expect(authedPage.getByText(/card|no active listings/i).first()).toBeVisible();
  });
});
