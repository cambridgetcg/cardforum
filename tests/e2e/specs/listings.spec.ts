import { test, expect } from "../fixtures/auth.fixture";
import { ListingsPage } from "../pages/listings.page";

/**
 * Listings tests — verify tab toggle, create form, listing display.
 *
 * Listings page uses raw fetch() in useCallback for /api/listings and /api/graded-listings.
 * The create buttons open IntentPanel (Sheet) with CardSearch or CreateGradedListingForm.
 */
test.describe("Listings", () => {
  test("listings page loads with tabs", async ({ authedPage }) => {
    const listings = new ListingsPage(authedPage);
    await listings.navigate();
    await listings.assertHeading("My Listings");
    await listings.assertTabs();
    await listings.assertCreateButtons();
  });

  test("can switch to graded tab", async ({ authedPage }) => {
    const listings = new ListingsPage(authedPage);
    await listings.navigate();

    // Wait for page to settle (listings load on mount)
    await authedPage.waitForLoadState("networkidle");

    await listings.switchToGraded();
    await expect(authedPage.getByText("Graded Cards I Have")).toBeVisible();
    await expect(authedPage.getByText("Graded Cards I Want")).toBeVisible();
  });

  test("create have button opens form panel", async ({ authedPage }) => {
    const listings = new ListingsPage(authedPage);
    await listings.navigate();

    // Wait for listings to load
    await authedPage.waitForLoadState("networkidle");

    await listings.clickCreateHave();

    // IntentPanel opens as Sheet with title "I have this card"
    // and shows CardSearch with placeholder "Search cards by name, set, or code..."
    await expect(authedPage.getByText("I have this card").first()).toBeVisible({ timeout: 5_000 });
  });

  test("shows empty state for new user", async ({ authedPage }) => {
    const listings = new ListingsPage(authedPage);
    await listings.navigate();

    // Wait for listings to load
    await authedPage.waitForLoadState("networkidle");

    // New test user has no listings — should see "No have listings yet"
    await expect(authedPage.getByText(/no have listings yet/i)).toBeVisible();
    await expect(authedPage.getByText(/no want listings yet/i)).toBeVisible();
  });
});
