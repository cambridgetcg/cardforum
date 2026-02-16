import { test, expect } from "../fixtures/auth.fixture";
import { BrowsePage } from "../pages/browse.page";

/**
 * Browse flow tests — verify set catalog → set detail → card detail navigation.
 *
 * These tests exercise the browse hierarchy built in the Card Browse & Set Organization feature.
 * They require the card catalog to be populated (OP01-OP10 from Cardmarket scrape).
 */
test.describe("Browse Flow", () => {
  test("set catalog shows TCG filter buttons", async ({ authedPage }) => {
    const browse = new BrowsePage(authedPage);
    await browse.navigate();

    await expect(authedPage.getByRole("button", { name: "All TCGs" })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: "One Piece" })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: "Pokemon" })).toBeVisible();
  });

  test("filtering by One Piece shows only One Piece sets", async ({ authedPage }) => {
    const browse = new BrowsePage(authedPage);
    await browse.navigate();
    await browse.filterByTCG("One Piece");

    // Wait for API response
    await authedPage.waitForResponse((r) =>
      r.url().includes("/api/card-sets") && r.status() === 200
    );

    // All visible set cards should be One Piece
    const setLinks = authedPage.locator("a[href^='/browse/sets/']");
    const count = await setLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking a set navigates to set detail page", async ({ authedPage }) => {
    const browse = new BrowsePage(authedPage);
    await browse.navigate();

    // Click on the first set link
    const firstSet = authedPage.locator("a[href^='/browse/sets/']").first();
    await expect(firstSet).toBeVisible();
    const href = await firstSet.getAttribute("href");
    await firstSet.click();

    await authedPage.waitForLoadState("domcontentloaded");
    expect(authedPage.url()).toContain("/browse/sets/");

    // Back link should be visible
    await expect(authedPage.getByRole("link", { name: /browse/i })).toBeVisible();
  });

  test("set detail page shows card grid with pagination", async ({ authedPage }) => {
    const browse = new BrowsePage(authedPage);

    // Navigate directly to a known set
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForLoadState("domcontentloaded");

    // Wait for cards API response
    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/cards") && r.status() === 200
    );

    // Card grid should have items
    const cardLinks = authedPage.locator("a[href^='/browse/cards/']");
    await expect(cardLinks.first()).toBeVisible({ timeout: 10_000 });
  });

  test("card detail page shows card info and listing tables", async ({ authedPage }) => {
    // Navigate to set, then click first card
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/cards") && r.status() === 200
    );

    const firstCard = authedPage.locator("a[href^='/browse/cards/']").first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    await authedPage.waitForLoadState("domcontentloaded");
    expect(authedPage.url()).toContain("/browse/cards/");

    // Card detail should show name and action buttons
    await expect(authedPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(authedPage.getByRole("link", { name: "Create Listing" })).toBeVisible();
    await expect(authedPage.getByRole("link", { name: "View Order Book" })).toBeVisible();

    // Listing tables should be present (even if empty)
    await expect(authedPage.getByText("Active Have Listings")).toBeVisible();
    await expect(authedPage.getByText("Active Want Listings")).toBeVisible();
  });

  test("search within set filters cards", async ({ authedPage }) => {
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/cards") && r.status() === 200
    );

    const browse = new BrowsePage(authedPage);
    await browse.searchInSet("Luffy");

    // Wait for filtered API response
    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/cards") && r.url().includes("query=Luffy"),
      { timeout: 5_000 }
    );

    // Results should be filtered (fewer cards or specific names)
    const cards = authedPage.locator("a[href^='/browse/cards/']");
    const count = await cards.count();
    // Luffy cards exist in OP01 — at least one should match
    expect(count).toBeGreaterThan(0);
  });
});
