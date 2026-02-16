import { test, expect } from "../fixtures/auth.fixture";
import { CollectionPage } from "../pages/collection.page";

/**
 * Collection tests — verify stats, TCG filters, empty/populated states.
 */
test.describe("Collection", () => {
  test("collection page loads with heading", async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();
    await collection.assertHeading("My Collection");
  });

  test("shows stats cards after API response", async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/collection/stats") && r.status() === 200,
      { timeout: 10_000 },
    );

    await collection.assertStatsCards();
  });

  test("shows TCG filter buttons", async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/collection") && r.status() === 200,
      { timeout: 10_000 },
    );

    await collection.assertTCGFilters();
  });

  test("shows empty state or card entries", async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/collection") && !r.url().includes("/stats") && r.status() === 200,
      { timeout: 10_000 },
    );

    // Either empty state or card entries visible
    const hasCards = await authedPage.locator("a[href^='/browse/cards/']").count();
    if (hasCards === 0) {
      await collection.assertEmptyState();
    }
  });
});
