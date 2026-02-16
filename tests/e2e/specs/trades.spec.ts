import { test, expect } from "../fixtures/auth.fixture";
import { TradesPage } from "../pages/trades.page";

/**
 * Trades tests — verify trade list, mode filters, matching button.
 */
test.describe("Trades", () => {
  test("trades page loads with mode filters", async ({ authedPage }) => {
    const trades = new TradesPage(authedPage);
    await trades.navigate();
    await trades.assertHeading("Trades");
    await trades.assertModeFilters();
    await trades.assertFindMatchesButton();
  });

  test("shows active and history sections", async ({ authedPage }) => {
    const trades = new TradesPage(authedPage);
    await trades.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/trades") && r.status() === 200,
      { timeout: 10_000 },
    );

    await trades.assertActiveSection();
  });

  test("mode filter buttons toggle", async ({ authedPage }) => {
    const trades = new TradesPage(authedPage);
    await trades.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/trades") && r.status() === 200,
      { timeout: 10_000 },
    );

    // Click Direct filter
    await authedPage.getByRole("button", { name: "Direct" }).click();
    // Click back to All
    await authedPage.getByRole("button", { name: "All" }).click();
  });
});
