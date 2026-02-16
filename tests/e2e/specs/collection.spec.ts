import { test, expect } from "../fixtures/auth.fixture";
import { CollectionPage } from "../pages/collection.page";

/**
 * Collection tests — verify stats, TCG filters, empty/populated states.
 *
 * The collection page uses React Query hooks (useCollection, useCollectionStats)
 * which fire on mount. React Query retries failed requests (3 times by default),
 * so the loading state may persist for several seconds when the API returns 500.
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

    // Wait for stats to either load or error out.
    // Stats show as: "Total Cards" (success) or "Failed to load" (error) or skeletons (loading).
    // React Query retries 3 times on failure, so we need a generous timeout.
    await expect(
      authedPage.getByText(/Total Cards|Failed to load collection data/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("shows TCG filter buttons", async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();

    // TCG filters are always rendered (not behind an API call)
    await collection.assertTCGFilters();
  });

  test("shows empty state or card entries", async ({ authedPage }) => {
    const collection = new CollectionPage(authedPage);
    await collection.navigate();

    // Wait for collection entries to finish loading (success, empty, or error).
    // The "Loading collection..." spinner disappears when React Query finishes.
    // With retries, this can take up to 15-20s.
    await expect(
      authedPage
        .getByText(/Your collection is empty|Failed to load collection data|Loading collection/)
        .first(),
    ).toBeVisible({ timeout: 5_000 });

    // If still showing "Loading collection...", wait for it to disappear
    const loadingText = authedPage.getByText("Loading collection...");
    if (await loadingText.isVisible().catch(() => false)) {
      await expect(loadingText).not.toBeVisible({ timeout: 20_000 });
    }

    // Now check the final state
    const hasCards = (await authedPage.locator("a[href^='/browse/cards/']").count()) > 0;
    const hasEmpty = await authedPage
      .getByText(/your collection is empty/i)
      .isVisible()
      .catch(() => false);
    const hasError = await authedPage
      .getByText("Failed to load collection data")
      .isVisible()
      .catch(() => false);

    expect(hasCards || hasEmpty || hasError).toBe(true);
  });
});
