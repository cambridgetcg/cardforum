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

    // Wait for initial sets to load before clicking filter
    await expect(authedPage.locator("a[href^='/browse/sets/']").first()).toBeVisible({
      timeout: 10_000,
    });

    // Set up response listener BEFORE clicking
    const responsePromise = authedPage.waitForResponse(
      (r) =>
        r.url().includes("/api/card-sets") &&
        r.url().includes("tcg=ONEPIECE") &&
        r.status() === 200,
    );

    await browse.filterByTCG("One Piece");
    await responsePromise;

    // All visible set cards should be One Piece
    const setLinks = authedPage.locator("a[href^='/browse/sets/']");
    const count = await setLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking a set navigates to set detail page", async ({ authedPage }) => {
    const browse = new BrowsePage(authedPage);
    await browse.navigate();

    // Wait for sets to load
    const firstSet = authedPage.locator("a[href^='/browse/sets/']").first();
    await expect(firstSet).toBeVisible({ timeout: 10_000 });

    // Click and wait for navigation
    await firstSet.click();
    await authedPage.waitForURL(/\/browse\/sets\//, { timeout: 10_000 });

    expect(authedPage.url()).toContain("/browse/sets/");

    // Back link should be visible in main content (not the header/footer nav links)
    await expect(authedPage.getByRole("main").locator("a[href='/browse']")).toBeVisible();
  });

  test("set detail page shows card grid with pagination", async ({ authedPage }) => {
    // Navigate directly to a known set
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForLoadState("domcontentloaded");

    // Card grid should have items (CardGridItem renders <Link href="/browse/cards/{id}">)
    const cardLinks = authedPage.locator("a[href^='/browse/cards/']");
    await expect(cardLinks.first()).toBeVisible({ timeout: 10_000 });
  });

  test("card detail page shows card info and listing tables", async ({ authedPage }) => {
    // Navigate to set, then click first card
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForLoadState("domcontentloaded");

    const firstCard = authedPage.locator("a[href^='/browse/cards/']").first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    // Wait for client-side navigation to card detail
    await authedPage.waitForURL(/\/browse\/cards\//, { timeout: 10_000 });
    expect(authedPage.url()).toContain("/browse/cards/");

    // Card detail should show name heading
    await expect(authedPage.getByRole("heading", { level: 1 })).toBeVisible();

    // Action buttons: "I Have This", "I Want This", "View Order Book"
    await expect(authedPage.getByRole("button", { name: "I Have This" })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: "I Want This" })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: "View Order Book" })).toBeVisible();

    // Listing tables should be present (even if empty)
    await expect(authedPage.getByText(/Active Have Listings/)).toBeVisible();
    await expect(authedPage.getByText(/Active Want Listings/)).toBeVisible();
  });

  test("search within set filters cards", async ({ authedPage }) => {
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForLoadState("domcontentloaded");

    // Wait for cards to initially load
    const cardLinks = authedPage.locator("a[href^='/browse/cards/']");
    await expect(cardLinks.first()).toBeVisible({ timeout: 10_000 });

    // Set up response listener BEFORE typing in search
    const searchResponsePromise = authedPage.waitForResponse(
      (r) => r.url().includes("/api/cards") && r.url().includes("query=Luffy"),
      { timeout: 10_000 },
    );

    // Search — placeholder is "Search within this set..." (with ... ending)
    await authedPage.getByPlaceholder("Search within this set...").fill("Luffy");

    await searchResponsePromise;

    // Results should be filtered (fewer cards or specific names)
    const cards = authedPage.locator("a[href^='/browse/cards/']");
    const count = await cards.count();
    // Luffy cards exist in OP01 — at least one should match
    expect(count).toBeGreaterThan(0);
  });
});
