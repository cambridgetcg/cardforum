import { test, expect } from "../fixtures/auth.fixture";
import { ListingsPage } from "../pages/listings.page";

/**
 * Listings tests — verify tab toggle, create form, listing display.
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

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/listings"),
      { timeout: 10_000 },
    );

    await listings.switchToGraded();
    await expect(authedPage.getByText("Graded Cards I Have")).toBeVisible();
    await expect(authedPage.getByText("Graded Cards I Want")).toBeVisible();
  });

  test("create have button opens form panel", async ({ authedPage }) => {
    const listings = new ListingsPage(authedPage);
    await listings.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/listings"),
      { timeout: 10_000 },
    );

    await listings.clickCreateHave();

    // The intent panel or create form should appear
    await expect(
      authedPage.getByText(/search for a card|select a card|card search/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("shows empty state for new user", async ({ authedPage }) => {
    const listings = new ListingsPage(authedPage);
    await listings.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/listings"),
      { timeout: 10_000 },
    );

    // New test user has no listings — should see "No have listings yet"
    await expect(authedPage.getByText(/no have listings yet/i)).toBeVisible();
    await expect(authedPage.getByText(/no want listings yet/i)).toBeVisible();
  });
});
